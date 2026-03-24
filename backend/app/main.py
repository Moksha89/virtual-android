from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import os
import json
import asyncio
import secrets
import hashlib
from pathlib import Path
from datetime import datetime, timezone

from app.models import (
    CreateDeviceRequest,
    EditDeviceRequest,
    CreateProfileRequest,
    DeviceInfo,
    DeviceStatus,
    HardwareProfile,
    ServerStatus,
    AndroidVersion,
    OSType,
    LoginRequest,
    RegisterRequest,
    UserResponse,
    UpdateUserRequest,
    AssignDeviceRequest,
    DeviceControlRequest,
)
from app.profiles import get_all_profiles, get_profile_by_id, PREDEFINED_PROFILES
from app.ssh_manager import (
    get_server_status,
    get_running_devices,
    get_device_properties,
    get_cuttlefish_instances,
    launch_device,
    stop_device,
    get_next_instance_id,
    install_gapps,
    run_adb_command,
    take_screenshot_base64,
    PUBLIC_IP,
    list_device_files,
    pull_file_base64,
    push_file_from_base64,
    delete_device_file,
    list_installed_apps,
    install_apk_from_base64,
    uninstall_app,
    force_stop_app,
    clear_app_data,
    start_screen_recording,
    stop_screen_recording,
    get_screen_recording_base64,
    get_clipboard,
    set_clipboard,
    set_network_throttle,
    create_snapshot,
    list_snapshots,
    delete_snapshot,
    create_adb_shell_session,
    create_logcat_session,
    get_device_health,
    set_gps_location,
    send_sms,
    make_call,
    end_call,
    set_device_locale,
    get_device_locale,
    get_device_processes,
    get_webview_debug_url,
    take_screenshot_for_comparison,
    run_monkey_test,
    start_input_recording,
    stop_input_recording,
    get_input_recording,
    replay_input_recording,
    set_boot_animation,
    get_device_branding,
    set_device_branding,
    get_smart_recommendations,
)
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_optional_user,
    require_admin,
)
from app.database import get_db, init_db

load_dotenv()

app = FastAPI(title="Cuttlefish Device Manager", version="2.0.0")

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# In-memory store for custom profiles and device metadata
DATA_DIR = Path("/data") if os.path.exists("/data") else Path(__file__).parent.parent
CUSTOM_PROFILES_FILE = DATA_DIR / "custom_profiles.json"
DEVICES_FILE = DATA_DIR / "devices.json"

custom_profiles: list[HardwareProfile] = []
device_metadata: dict[str, dict] = {}  # instance_id -> metadata


def load_data():
    global custom_profiles, device_metadata
    if CUSTOM_PROFILES_FILE.exists():
        try:
            data = json.loads(CUSTOM_PROFILES_FILE.read_text())
            custom_profiles = [HardwareProfile(**p) for p in data]
        except Exception:
            custom_profiles = []
    if DEVICES_FILE.exists():
        try:
            device_metadata = json.loads(DEVICES_FILE.read_text())
        except Exception:
            device_metadata = {}


def save_profiles():
    CUSTOM_PROFILES_FILE.write_text(
        json.dumps([p.model_dump() for p in custom_profiles], indent=2)
    )


def save_devices():
    DEVICES_FILE.write_text(json.dumps(device_metadata, indent=2))


load_data()


@app.on_event("startup")
async def startup():
    await init_db()


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


# --- Auth Endpoints ---


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    """Login and get access token."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, username, email, role, is_active, password_hash FROM users WHERE username = ?",
            (req.username,),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        user_id, username, email, role, is_active, password_hash = row
        if not is_active:
            raise HTTPException(status_code=403, detail="Account is disabled")
        if not verify_password(req.password, password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Update last_login
        await db.execute(
            "UPDATE users SET last_login = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(), user_id),
        )
        await db.commit()

        token = create_access_token(user_id, username, role)
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "username": username,
                "email": email,
                "role": role,
            },
        }
    finally:
        await db.close()


@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    """Register a new user (creates regular user)."""
    db = await get_db()
    try:
        # Check if username/email already exists
        cursor = await db.execute(
            "SELECT id FROM users WHERE username = ? OR email = ?",
            (req.username, req.email),
        )
        if await cursor.fetchone():
            raise HTTPException(status_code=409, detail="Username or email already exists")

        pw_hash = hash_password(req.password)
        cursor = await db.execute(
            "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (req.username, req.email, pw_hash, "user"),
        )
        await db.commit()
        user_id = cursor.lastrowid

        token = create_access_token(user_id, req.username, "user")
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "username": req.username,
                "email": req.email,
                "role": "user",
            },
        }
    finally:
        await db.close()


@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get current user info."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, username, email, role, is_active, created_at, last_login FROM users WHERE id = ?",
            (user["id"],),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return UserResponse(
            id=row[0], username=row[1], email=row[2], role=row[3],
            is_active=bool(row[4]), created_at=row[5], last_login=row[6],
        )
    finally:
        await db.close()


# --- Admin: User Management ---


@app.get("/api/admin/users")
async def list_users(admin: dict = Depends(require_admin)):
    """List all users (admin only)."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, username, email, role, is_active, created_at, last_login FROM users ORDER BY id"
        )
        rows = await cursor.fetchall()
        return [
            UserResponse(
                id=r[0], username=r[1], email=r[2], role=r[3],
                is_active=bool(r[4]), created_at=r[5], last_login=r[6],
            )
            for r in rows
        ]
    finally:
        await db.close()


@app.put("/api/admin/users/{user_id}")
async def update_user(user_id: int, req: UpdateUserRequest, admin: dict = Depends(require_admin)):
    """Update user role or active status (admin only)."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")

        if req.role is not None:
            if req.role not in ("admin", "user"):
                raise HTTPException(status_code=400, detail="Invalid role")
            await db.execute("UPDATE users SET role = ? WHERE id = ?", (req.role, user_id))

        if req.is_active is not None:
            await db.execute("UPDATE users SET is_active = ? WHERE id = ?", (int(req.is_active), user_id))

        await db.commit()
        return {"message": "User updated"}
    finally:
        await db.close()


@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: int, admin: dict = Depends(require_admin)):
    """Delete a user (admin only)."""
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db = await get_db()
    try:
        await db.execute("DELETE FROM users WHERE id = ?", (user_id,))
        await db.commit()
        return {"message": "User deleted"}
    finally:
        await db.close()


@app.post("/api/admin/users", status_code=201)
async def admin_create_user(req: RegisterRequest, admin: dict = Depends(require_admin)):
    """Create a new user (admin only)."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM users WHERE username = ? OR email = ?",
            (req.username, req.email),
        )
        if await cursor.fetchone():
            raise HTTPException(status_code=409, detail="Username or email already exists")

        pw_hash = hash_password(req.password)
        cursor = await db.execute(
            "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (req.username, req.email, pw_hash, "user"),
        )
        await db.commit()
        return {"message": "User created", "user_id": cursor.lastrowid}
    finally:
        await db.close()


# --- Admin: Device Assignments ---


@app.get("/api/admin/assignments")
async def list_assignments(admin: dict = Depends(require_admin)):
    """List all device assignments."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT da.device_id, da.user_id, u.username FROM device_assignments da JOIN users u ON da.user_id = u.id"
        )
        rows = await cursor.fetchall()
        return [{"device_id": r[0], "user_id": r[1], "username": r[2]} for r in rows]
    finally:
        await db.close()


@app.post("/api/admin/assignments")
async def assign_device(req: AssignDeviceRequest, admin: dict = Depends(require_admin)):
    """Assign a device to a user."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM users WHERE id = ?", (req.user_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")

        try:
            await db.execute(
                "INSERT INTO device_assignments (device_id, user_id) VALUES (?, ?)",
                (req.device_id, req.user_id),
            )
            await db.commit()
        except Exception:
            raise HTTPException(status_code=409, detail="Device already assigned to this user")

        return {"message": "Device assigned"}
    finally:
        await db.close()


@app.delete("/api/admin/assignments/{device_id}/{user_id}")
async def unassign_device(device_id: str, user_id: int, admin: dict = Depends(require_admin)):
    """Unassign a device from a user."""
    db = await get_db()
    try:
        await db.execute(
            "DELETE FROM device_assignments WHERE device_id = ? AND user_id = ?",
            (device_id, user_id),
        )
        await db.commit()
        return {"message": "Device unassigned"}
    finally:
        await db.close()


# --- Hardware Profiles ---


@app.get("/api/profiles", response_model=list[HardwareProfile])
async def list_profiles():
    """List all hardware profiles (predefined + custom)."""
    return get_all_profiles() + custom_profiles


@app.get("/api/profiles/{profile_id}", response_model=HardwareProfile)
async def get_profile(profile_id: str):
    """Get a specific hardware profile."""
    profile = get_profile_by_id(profile_id)
    if not profile:
        for p in custom_profiles:
            if p.id == profile_id:
                return p
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.post("/api/profiles", response_model=HardwareProfile)
async def create_profile(req: CreateProfileRequest):
    """Create a custom hardware profile."""
    profile_id = req.name.lower().replace(" ", "-").replace("_", "-")
    existing = get_profile_by_id(profile_id)
    if existing or any(p.id == profile_id for p in custom_profiles):
        raise HTTPException(status_code=409, detail="Profile with this name already exists")

    profile = HardwareProfile(
        id=profile_id,
        name=req.name,
        brand=req.brand,
        category=req.category,
        x_res=req.x_res,
        y_res=req.y_res,
        dpi=req.dpi,
        default_ram_mb=req.default_ram_mb,
        default_storage_gb=req.default_storage_gb,
        default_cpus=req.default_cpus,
        description=req.description,
        icon="smartphone" if req.category != "tablet" else "tablet",
        is_custom=True,
    )
    custom_profiles.append(profile)
    save_profiles()
    return profile


@app.delete("/api/profiles/{profile_id}")
async def delete_profile(profile_id: str):
    """Delete a custom hardware profile."""
    global custom_profiles
    original_len = len(custom_profiles)
    custom_profiles = [p for p in custom_profiles if p.id != profile_id]
    if len(custom_profiles) == original_len:
        raise HTTPException(status_code=404, detail="Custom profile not found")
    save_profiles()
    return {"message": "Profile deleted"}


# --- Android Versions & OS Types ---


@app.get("/api/android-versions", response_model=list[AndroidVersion])
async def list_android_versions():
    """List available Android versions."""
    return [
        AndroidVersion(
            version="14",
            api_level=34,
            codename="Upside Down Cake",
            images_dir="/home/administrator/cf-images-a14",
            available=True,
        ),
        AndroidVersion(
            version="15",
            api_level=35,
            codename="Vanilla Ice Cream",
            images_dir="/home/administrator/cf-images-a15",
            available=False,
        ),
        AndroidVersion(
            version="16",
            api_level=36,
            codename="Baklava",
            images_dir="/home/administrator/cf-images-a16",
            available=False,
        ),
    ]


@app.get("/api/os-types", response_model=list[OSType])
async def list_os_types():
    """List available OS types."""
    return [
        OSType(id="aosp", name="AOSP (Stock Android)", description="Pure Android Open Source Project", available=True, icon="smartphone"),
        OSType(id="lineageos", name="LineageOS", description="Free and open-source operating system based on Android", available=False, icon="smartphone"),
        OSType(id="grapheneos", name="GrapheneOS", description="Privacy and security focused mobile OS", available=False, icon="shield"),
        OSType(id="calyxos", name="CalyxOS", description="Privacy by design Android mobile OS", available=False, icon="shield"),
        OSType(id="evolution-x", name="Evolution X", description="Custom ROM with Pixel features and customization", available=False, icon="smartphone"),
        OSType(id="miui", name="MIUI (HyperOS)", description="Xiaomi's custom Android skin", available=False, icon="smartphone"),
    ]


# --- Devices ---


async def _get_device_assignments() -> dict[str, list[str]]:
    """Get all device assignments as {device_id: [username, ...]}."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT da.device_id, u.username FROM device_assignments da JOIN users u ON da.user_id = u.id"
        )
        rows = await cursor.fetchall()
        assignments: dict[str, list[str]] = {}
        for r in rows:
            assignments.setdefault(r[0], []).append(r[1])
        return assignments
    finally:
        await db.close()


@app.get("/api/devices")
async def list_devices(user: dict | None = Depends(get_optional_user)):
    """List all Cuttlefish devices with their status."""
    instances = await get_cuttlefish_instances()
    adb_devices = await get_running_devices()
    adb_serials = {d["serial"] for d in adb_devices}
    assignments = await _get_device_assignments()

    devices = []
    for inst in instances:
        iid = inst["instance_id"]
        iid_str = str(iid)
        adb_port = 6520 + iid - 1
        webrtc_port = 8443
        serial = f"0.0.0.0:{adb_port}"

        meta = device_metadata.get(iid_str, {})

        if inst["running"]:
            if serial in adb_serials:
                status = DeviceStatus.RUNNING
            else:
                status = DeviceStatus.STARTING
        else:
            status = DeviceStatus.STOPPED

        profile_id = meta.get("profile_id", "google-pixel-8")
        profile = get_profile_by_id(profile_id)
        if not profile:
            for p in custom_profiles:
                if p.id == profile_id:
                    profile = p
                    break
        if not profile:
            profile = PREDEFINED_PROFILES[8]  # Default to Pixel 8

        device_id = f"cvd-{iid}"
        device = DeviceInfo(
            id=device_id,
            name=meta.get("name", f"Cuttlefish {iid}"),
            instance_id=iid,
            profile_id=profile.id,
            profile_name=profile.name,
            android_version=meta.get("android_version", "14"),
            os_type=meta.get("os_type", "aosp"),
            status=status,
            ram_mb=meta.get("ram_mb", profile.default_ram_mb),
            storage_gb=meta.get("storage_gb", profile.default_storage_gb),
            cpus=meta.get("cpus", profile.default_cpus),
            x_res=meta.get("x_res", profile.x_res),
            y_res=meta.get("y_res", profile.y_res),
            dpi=meta.get("dpi", profile.dpi),
            gpu_mode=meta.get("gpu_mode", "guest_swiftshader"),
            adb_port=adb_port,
            webrtc_port=webrtc_port,
            adb_serial=serial,
            ip=PUBLIC_IP,
            assigned_users=assignments.get(device_id, []),
        )

        # If user is not admin, only show devices assigned to them (or all if no auth)
        if user and user["role"] != "admin":
            if device_id in assignments and user["username"] not in assignments[device_id]:
                continue

        devices.append(device)

    return devices


@app.post("/api/devices")
async def create_device(req: CreateDeviceRequest):
    """Create and launch a new Cuttlefish device."""
    profile = get_profile_by_id(req.profile_id)
    if not profile:
        for p in custom_profiles:
            if p.id == req.profile_id:
                profile = p
                break
    if not profile:
        raise HTTPException(status_code=404, detail="Hardware profile not found")

    instance_id = await get_next_instance_id()

    device_metadata[str(instance_id)] = {
        "name": req.name,
        "profile_id": req.profile_id,
        "android_version": req.android_version,
        "os_type": req.os_type,
        "ram_mb": req.ram_mb,
        "storage_gb": req.storage_gb,
        "cpus": req.cpus,
        "x_res": profile.x_res,
        "y_res": profile.y_res,
        "dpi": profile.dpi,
        "gpu_mode": req.gpu_mode,
    }
    save_devices()

    success, message = await launch_device(
        instance_id=instance_id,
        ram_mb=req.ram_mb,
        storage_gb=req.storage_gb,
        cpus=req.cpus,
        x_res=profile.x_res,
        y_res=profile.y_res,
        dpi=profile.dpi,
        gpu_mode=req.gpu_mode,
    )

    if not success:
        del device_metadata[str(instance_id)]
        save_devices()
        raise HTTPException(status_code=500, detail=message)

    adb_port = 6520 + instance_id - 1

    # Auto-install GApps in background after device launches
    import asyncio
    asyncio.create_task(_install_gapps_background(instance_id, adb_port))

    return {
        "id": f"cvd-{instance_id}",
        "name": req.name,
        "instance_id": instance_id,
        "status": "starting",
        "adb_port": adb_port,
        "adb_serial": f"0.0.0.0:{adb_port}",
        "message": message,
    }


async def _install_gapps_background(instance_id: int, adb_port: int):
    """Background task to install GApps after device boots."""
    import asyncio
    serial = f"0.0.0.0:{adb_port}"
    # Wait for device to boot (up to 3 minutes)
    for _ in range(36):
        await asyncio.sleep(5)
        try:
            props = await get_device_properties(serial)
            if props.get("boot_completed"):
                break
        except Exception:
            pass
    else:
        print(f"[GApps] Device {instance_id} did not boot in time, skipping GApps install")
        return

    # Give it a few more seconds after boot
    await asyncio.sleep(10)

    try:
        success, msg = await install_gapps(serial)
        if success:
            print(f"[GApps] Successfully installed GApps on device {instance_id}")
        else:
            print(f"[GApps] Failed to install GApps on device {instance_id}: {msg}")
    except Exception as e:
        print(f"[GApps] Error installing GApps on device {instance_id}: {e}")


@app.put("/api/devices/{device_id}")
async def edit_device(device_id: str, req: EditDeviceRequest):
    """Edit device metadata (name, RAM, storage, CPUs)."""
    if not device_id.startswith("cvd-"):
        raise HTTPException(status_code=400, detail="Invalid device ID format")

    try:
        instance_id = int(device_id.replace("cvd-", ""))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    iid_str = str(instance_id)
    if iid_str not in device_metadata:
        device_metadata[iid_str] = {}

    meta = device_metadata[iid_str]
    if req.name is not None:
        meta["name"] = req.name
    if req.ram_mb is not None:
        meta["ram_mb"] = req.ram_mb
    if req.storage_gb is not None:
        meta["storage_gb"] = req.storage_gb
    if req.cpus is not None:
        meta["cpus"] = req.cpus

    save_devices()
    return {"message": "Device updated", "metadata": meta}


@app.delete("/api/devices/{device_id}")
async def delete_device(device_id: str, passcode: str | None = None):
    """Stop and remove a Cuttlefish device. Requires passcode if set."""
    if not device_id.startswith("cvd-"):
        raise HTTPException(status_code=400, detail="Invalid device ID format")

    # Check if delete passcode is set
    db = await get_db()
    try:
        cursor = await db.execute("SELECT value FROM settings WHERE key = 'delete_passcode'")
        row = await cursor.fetchone()
        if row and row[0]:
            if not passcode:
                raise HTTPException(status_code=403, detail="Passcode required to delete device")
            if passcode != row[0]:
                raise HTTPException(status_code=403, detail="Invalid passcode")
    finally:
        await db.close()

    try:
        instance_id = int(device_id.replace("cvd-", ""))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    success, message = await stop_device(instance_id)

    iid_str = str(instance_id)
    if iid_str in device_metadata:
        del device_metadata[iid_str]
        save_devices()

    # Also remove assignments
    db = await get_db()
    try:
        await db.execute("DELETE FROM device_assignments WHERE device_id = ?", (device_id,))
        await db.commit()
    finally:
        await db.close()

    if not success:
        raise HTTPException(status_code=500, detail=message)

    return {"message": message}


@app.get("/api/devices/{device_id}")
async def get_device(device_id: str):
    """Get detailed info about a specific device."""
    if not device_id.startswith("cvd-"):
        raise HTTPException(status_code=400, detail="Invalid device ID format")

    try:
        instance_id = int(device_id.replace("cvd-", ""))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    adb_port = 6520 + instance_id - 1
    serial = f"0.0.0.0:{adb_port}"

    props = await get_device_properties(serial)
    meta = device_metadata.get(str(instance_id), {})

    return {
        "id": device_id,
        "instance_id": instance_id,
        "name": meta.get("name", f"Cuttlefish {instance_id}"),
        "properties": props,
        "metadata": meta,
        "adb_serial": serial,
        "adb_port": adb_port,
        "ip": PUBLIC_IP,
    }


# --- Device Control ---


@app.post("/api/devices/{device_id}/control")
async def device_control(device_id: str, req: DeviceControlRequest):
    """Send a control command to a device (keyevent, text input, tap, swipe, etc.)."""
    if not device_id.startswith("cvd-"):
        raise HTTPException(status_code=400, detail="Invalid device ID format")
    try:
        instance_id = int(device_id.replace("cvd-", ""))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    adb_port = 6520 + instance_id - 1
    serial = f"0.0.0.0:{adb_port}"

    action = req.action
    params = req.params

    if action == "keyevent":
        keycode = params.get("keycode", "")
        if not keycode:
            raise HTTPException(status_code=400, detail="keycode required")
        cmd = f"input keyevent {keycode}"
    elif action == "text":
        text = params.get("text", "")
        if not text:
            raise HTTPException(status_code=400, detail="text required")
        # Escape special chars for adb shell
        escaped = text.replace("'", "'\"'\"'")
        cmd = f"input text '{escaped}'"
    elif action == "tap":
        x = params.get("x", 0)
        y = params.get("y", 0)
        cmd = f"input tap {x} {y}"
    elif action == "swipe":
        x1 = params.get("x1", 0)
        y1 = params.get("y1", 0)
        x2 = params.get("x2", 0)
        y2 = params.get("y2", 0)
        duration = params.get("duration", 300)
        cmd = f"input swipe {x1} {y1} {x2} {y2} {duration}"
    elif action == "shell":
        shell_cmd = params.get("command", "")
        if not shell_cmd:
            raise HTTPException(status_code=400, detail="command required")
        cmd = shell_cmd
    elif action == "rotation":
        orientation = params.get("orientation", "portrait")
        if orientation == "landscape":
            cmd = "settings put system accelerometer_rotation 0 && settings put system user_rotation 1"
        else:
            cmd = "settings put system accelerometer_rotation 0 && settings put system user_rotation 0"
    elif action == "show_keyboard":
        # Trigger soft keyboard by focusing on a text field
        cmd = "input keyevent KEYCODE_SEARCH"
    elif action == "hide_keyboard":
        cmd = "input keyevent KEYCODE_BACK"
    elif action == "open_settings":
        cmd = "am start -a android.settings.SETTINGS"
    elif action == "open_playstore":
        cmd = "am start -a android.intent.action.MAIN -n com.android.vending/.AssetBrowserActivity 2>/dev/null || am start -a android.intent.action.MAIN -c android.intent.category.APP_MARKET"
    elif action == "screenshot":
        result = await take_screenshot_base64(serial)
        if result:
            return {"success": True, "image_base64": result}
        raise HTTPException(status_code=500, detail="Failed to take screenshot")
    elif action == "battery":
        level = params.get("level", 100)
        cmd = f"dumpsys battery set level {level}"
    elif action == "gps":
        lat = params.get("latitude", 37.4220)
        lng = params.get("longitude", -122.0841)
        cmd = f"am broadcast -a com.android.internal.location.MOCK_LOCATION_PROVIDER --ef latitude {lat} --ef longitude {lng} 2>/dev/null; echo 'GPS set to {lat},{lng}'"
    elif action == "network":
        mode = params.get("mode", "on")
        if mode == "off":
            cmd = "svc wifi disable && svc data disable"
        elif mode == "airplane":
            cmd = "settings put global airplane_mode_on 1 && am broadcast -a android.intent.action.AIRPLANE_MODE"
        else:
            cmd = "svc wifi enable && svc data enable && settings put global airplane_mode_on 0"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")

    stdout, stderr, rc = await run_adb_command(serial, cmd)
    return {
        "success": rc == 0,
        "stdout": stdout,
        "stderr": stderr,
        "return_code": rc,
    }


@app.post("/api/devices/{device_id}/install-gapps")
async def install_gapps_endpoint(device_id: str):
    """Manually trigger GApps installation on a device."""
    if not device_id.startswith("cvd-"):
        raise HTTPException(status_code=400, detail="Invalid device ID format")
    try:
        instance_id = int(device_id.replace("cvd-", ""))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    adb_port = 6520 + instance_id - 1
    serial = f"0.0.0.0:{adb_port}"

    success, message = await install_gapps(serial)
    if not success:
        raise HTTPException(status_code=500, detail=message)
    return {"message": message}


# --- Settings ---


@app.get("/api/admin/settings/delete-passcode")
async def get_delete_passcode():
    """Get the current delete passcode (admin only)."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT value FROM settings WHERE key = 'delete_passcode'")
        row = await cursor.fetchone()
        return {"passcode": row[0] if row else ""}
    finally:
        await db.close()


@app.put("/api/admin/settings/delete-passcode")
async def set_delete_passcode(data: dict):
    """Set or update the delete passcode (admin only)."""
    passcode = data.get("passcode", "")
    db = await get_db()
    try:
        if passcode:
            await db.execute(
                "INSERT INTO settings (key, value) VALUES ('delete_passcode', ?) ON CONFLICT(key) DO UPDATE SET value = ?",
                (passcode, passcode),
            )
        else:
            await db.execute("DELETE FROM settings WHERE key = 'delete_passcode'")
        await db.commit()
        return {"message": "Delete passcode updated"}
    finally:
        await db.close()


@app.get("/api/settings/delete-passcode-required")
async def is_delete_passcode_required():
    """Check if a delete passcode is required (public endpoint)."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT value FROM settings WHERE key = 'delete_passcode'")
        row = await cursor.fetchone()
        return {"required": bool(row and row[0])}
    finally:
        await db.close()


# --- File Manager ---


def _get_serial(device_id: str) -> str:
    """Get ADB serial from device ID."""
    iid = int(device_id.replace("cvd-", ""))
    port = 6520 + iid - 1
    return f"0.0.0.0:{port}"


@app.get("/api/devices/{device_id}/files")
async def device_list_files(device_id: str, path: str = "/sdcard"):
    serial = _get_serial(device_id)
    files = await list_device_files(serial, path)
    return {"path": path, "files": files}


@app.get("/api/devices/{device_id}/files/download")
async def device_download_file(device_id: str, path: str):
    serial = _get_serial(device_id)
    data = await pull_file_base64(serial, path)
    if not data:
        raise HTTPException(status_code=404, detail="File not found or empty")
    return {"data": data, "filename": path.split("/")[-1]}


@app.post("/api/devices/{device_id}/files/upload")
async def device_upload_file(device_id: str, body: dict):
    serial = _get_serial(device_id)
    remote_path = body.get("path", "/sdcard/")
    data_b64 = body.get("data", "")
    filename = body.get("filename", "uploaded_file")
    if not data_b64:
        raise HTTPException(status_code=400, detail="No data provided")
    full_path = f"{remote_path.rstrip('/')}/{filename}"
    ok = await push_file_from_base64(serial, full_path, data_b64)
    if not ok:
        raise HTTPException(status_code=500, detail="Upload failed")
    return {"message": f"Uploaded to {full_path}"}


@app.delete("/api/devices/{device_id}/files")
async def device_delete_file(device_id: str, path: str):
    serial = _get_serial(device_id)
    ok = await delete_device_file(serial, path)
    if not ok:
        raise HTTPException(status_code=500, detail="Delete failed")
    return {"message": "Deleted"}


# --- App Management ---


@app.get("/api/devices/{device_id}/apps")
async def device_list_apps(device_id: str):
    serial = _get_serial(device_id)
    apps = await list_installed_apps(serial)
    return {"apps": apps}


@app.post("/api/devices/{device_id}/apps/install")
async def device_install_apk(device_id: str, body: dict):
    serial = _get_serial(device_id)
    data_b64 = body.get("data", "")
    filename = body.get("filename", "app.apk")
    if not data_b64:
        raise HTTPException(status_code=400, detail="No APK data provided")
    ok, msg = await install_apk_from_base64(serial, data_b64, filename)
    if not ok:
        raise HTTPException(status_code=500, detail=msg)
    # Log analytics
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO analytics_events (event_type, device_id, details) VALUES (?, ?, ?)",
            ("app_install", device_id, json.dumps({"filename": filename})),
        )
        await db.commit()
    finally:
        await db.close()
    return {"message": msg}


@app.delete("/api/devices/{device_id}/apps/{package}")
async def device_uninstall_app(device_id: str, package: str):
    serial = _get_serial(device_id)
    ok, msg = await uninstall_app(serial, package)
    if not ok:
        raise HTTPException(status_code=500, detail=msg)
    return {"message": msg}


@app.post("/api/devices/{device_id}/apps/{package}/stop")
async def device_force_stop(device_id: str, package: str):
    serial = _get_serial(device_id)
    await force_stop_app(serial, package)
    return {"message": f"Force stopped {package}"}


@app.post("/api/devices/{device_id}/apps/{package}/clear")
async def device_clear_data(device_id: str, package: str):
    serial = _get_serial(device_id)
    ok = await clear_app_data(serial, package)
    return {"message": f"Data cleared for {package}" if ok else "Clear failed"}


# --- Screen Recording ---


@app.post("/api/devices/{device_id}/recording/start")
async def device_start_recording(device_id: str, body: dict = {}):
    serial = _get_serial(device_id)
    duration = body.get("duration", 180)
    ok = await start_screen_recording(serial, duration)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to start recording")
    return {"message": "Recording started"}


@app.post("/api/devices/{device_id}/recording/stop")
async def device_stop_recording(device_id: str):
    serial = _get_serial(device_id)
    await stop_screen_recording(serial)
    return {"message": "Recording stopped"}


@app.get("/api/devices/{device_id}/recording/download")
async def device_download_recording(device_id: str):
    serial = _get_serial(device_id)
    data = await get_screen_recording_base64(serial)
    if not data:
        raise HTTPException(status_code=404, detail="No recording found")
    return {"data": data, "filename": "recording.mp4"}


# --- Clipboard ---


@app.get("/api/devices/{device_id}/clipboard")
async def device_get_clipboard(device_id: str):
    serial = _get_serial(device_id)
    text = await get_clipboard(serial)
    return {"text": text}


@app.post("/api/devices/{device_id}/clipboard")
async def device_set_clipboard(device_id: str, body: dict):
    serial = _get_serial(device_id)
    text = body.get("text", "")
    ok = await set_clipboard(serial, text)
    return {"message": "Clipboard set" if ok else "Failed"}


# --- Network Throttling ---


@app.post("/api/devices/{device_id}/network")
async def device_network_throttle(device_id: str, body: dict):
    serial = _get_serial(device_id)
    profile = body.get("profile", "none")
    ok, msg = await set_network_throttle(serial, profile)
    return {"success": ok, "message": msg}


@app.get("/api/network-profiles")
async def list_network_profiles():
    return {"profiles": [
        {"id": "none", "name": "No Throttling", "description": "Full speed connection"},
        {"id": "4g", "name": "4G LTE", "description": "30ms delay, 10Mbps"},
        {"id": "3g", "name": "3G", "description": "100ms delay, 1Mbps"},
        {"id": "2g", "name": "2G / Edge", "description": "300ms delay, 50Kbps"},
        {"id": "lossy", "name": "Lossy Network", "description": "200ms delay, 10% packet loss"},
    ]}


# --- Multi-device Actions ---


@app.post("/api/devices/bulk-action")
async def bulk_device_action(body: dict):
    device_ids = body.get("device_ids", [])
    action = body.get("action", "")
    params = body.get("params", {})
    if not device_ids or not action:
        raise HTTPException(status_code=400, detail="device_ids and action required")
    results = {}
    for did in device_ids:
        serial = _get_serial(did)
        try:
            if action == "reboot":
                stdout, _, _ = await run_adb_command(serial, "reboot")
                results[did] = {"success": True, "message": "Rebooting"}
            elif action == "screenshot":
                data = await take_screenshot_base64(serial)
                results[did] = {"success": bool(data), "message": "Screenshot taken" if data else "Failed"}
            elif action == "keyevent":
                keycode = params.get("keycode", "KEYCODE_HOME")
                await run_adb_command(serial, f"input keyevent {keycode}")
                results[did] = {"success": True, "message": f"Sent {keycode}"}
            elif action == "install_apk":
                data_b64 = params.get("data", "")
                if data_b64:
                    ok, msg = await install_apk_from_base64(serial, data_b64)
                    results[did] = {"success": ok, "message": msg}
                else:
                    results[did] = {"success": False, "message": "No APK data"}
            else:
                results[did] = {"success": False, "message": f"Unknown action: {action}"}
        except Exception as e:
            results[did] = {"success": False, "message": str(e)}
    return {"results": results}


# --- Device Templates ---


@app.get("/api/templates")
async def list_templates():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM device_templates ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


@app.post("/api/templates")
async def create_template(body: dict):
    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO device_templates (name, description, profile_id, android_version, os_type, ram_mb, storage_gb, cpus, gpu_mode, pre_installed_apps)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                body.get("name", ""),
                body.get("description", ""),
                body.get("profile_id", ""),
                body.get("android_version", "14"),
                body.get("os_type", "aosp"),
                body.get("ram_mb", 4096),
                body.get("storage_gb", 64),
                body.get("cpus", 4),
                body.get("gpu_mode", "guest_swiftshader"),
                json.dumps(body.get("pre_installed_apps", [])),
            ),
        )
        await db.commit()
        return {"message": "Template created"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await db.close()


@app.delete("/api/templates/{template_id}")
async def delete_template(template_id: int):
    db = await get_db()
    try:
        await db.execute("DELETE FROM device_templates WHERE id = ?", (template_id,))
        await db.commit()
        return {"message": "Template deleted"}
    finally:
        await db.close()


# --- API Keys ---


@app.get("/api/admin/api-keys")
async def list_api_keys():
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT ak.id, ak.name, ak.key_prefix, ak.permissions, ak.is_active, ak.created_at, ak.last_used, u.username FROM api_keys ak JOIN users u ON ak.user_id = u.id ORDER BY ak.created_at DESC"
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


@app.post("/api/admin/api-keys")
async def create_api_key(body: dict):
    name = body.get("name", "")
    user_id = body.get("user_id", 1)
    permissions = body.get("permissions", ["read"])
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    raw_key = f"mch_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:12] + "..."
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO api_keys (name, key_hash, key_prefix, user_id, permissions) VALUES (?, ?, ?, ?, ?)",
            (name, key_hash, key_prefix, user_id, json.dumps(permissions)),
        )
        await db.commit()
        return {"key": raw_key, "prefix": key_prefix, "message": "API key created. Save this key - it won't be shown again."}
    finally:
        await db.close()


@app.delete("/api/admin/api-keys/{key_id}")
async def delete_api_key(key_id: int):
    db = await get_db()
    try:
        await db.execute("DELETE FROM api_keys WHERE id = ?", (key_id,))
        await db.commit()
        return {"message": "API key deleted"}
    finally:
        await db.close()


# --- Notifications ---


@app.get("/api/notifications")
async def list_notifications(limit: int = 50):
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?", (limit,)
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


@app.post("/api/notifications")
async def create_notification(body: dict):
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO notifications (type, title, message, device_id) VALUES (?, ?, ?, ?)",
            (body.get("type", "info"), body.get("title", ""), body.get("message", ""), body.get("device_id")),
        )
        await db.commit()
        return {"message": "Notification created"}
    finally:
        await db.close()


@app.put("/api/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: int):
    db = await get_db()
    try:
        await db.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notif_id,))
        await db.commit()
        return {"message": "Marked as read"}
    finally:
        await db.close()


@app.put("/api/notifications/read-all")
async def mark_all_notifications_read():
    db = await get_db()
    try:
        await db.execute("UPDATE notifications SET is_read = 1")
        await db.commit()
        return {"message": "All marked as read"}
    finally:
        await db.close()


@app.delete("/api/notifications/{notif_id}")
async def delete_notification(notif_id: int):
    db = await get_db()
    try:
        await db.execute("DELETE FROM notifications WHERE id = ?", (notif_id,))
        await db.commit()
        return {"message": "Deleted"}
    finally:
        await db.close()


# --- Analytics ---


@app.get("/api/analytics/summary")
async def analytics_summary():
    db = await get_db()
    try:
        # Total events
        cursor = await db.execute("SELECT COUNT(*) FROM analytics_events")
        total = (await cursor.fetchone())[0]
        # Events by type
        cursor = await db.execute("SELECT event_type, COUNT(*) as count FROM analytics_events GROUP BY event_type ORDER BY count DESC")
        by_type = [dict(r) for r in await cursor.fetchall()]
        # Events last 24h
        cursor = await db.execute("SELECT COUNT(*) FROM analytics_events WHERE created_at > datetime('now', '-1 day')")
        last_24h = (await cursor.fetchone())[0]
        # Events by device
        cursor = await db.execute("SELECT device_id, COUNT(*) as count FROM analytics_events WHERE device_id IS NOT NULL GROUP BY device_id ORDER BY count DESC LIMIT 10")
        by_device = [dict(r) for r in await cursor.fetchall()]
        # Events timeline (last 7 days, grouped by day)
        cursor = await db.execute(
            "SELECT date(created_at) as day, COUNT(*) as count FROM analytics_events WHERE created_at > datetime('now', '-7 days') GROUP BY day ORDER BY day"
        )
        timeline = [dict(r) for r in await cursor.fetchall()]
        return {
            "total_events": total,
            "events_last_24h": last_24h,
            "by_type": by_type,
            "by_device": by_device,
            "timeline": timeline,
        }
    finally:
        await db.close()


@app.post("/api/analytics/event")
async def log_analytics_event(body: dict):
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO analytics_events (event_type, device_id, user_id, details) VALUES (?, ?, ?, ?)",
            (body.get("event_type", ""), body.get("device_id"), body.get("user_id"), json.dumps(body.get("details", {}))),
        )
        await db.commit()
        return {"message": "Event logged"}
    finally:
        await db.close()


# --- Snapshots ---


@app.get("/api/snapshots")
async def api_list_snapshots():
    snaps = await list_snapshots()
    return {"snapshots": snaps}


@app.post("/api/devices/{device_id}/snapshots")
async def api_create_snapshot(device_id: str, body: dict):
    serial = _get_serial(device_id)
    name = body.get("name", f"snap_{device_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    ok, msg = await create_snapshot(serial, name)
    if not ok:
        raise HTTPException(status_code=500, detail=msg)
    # Log analytics
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO analytics_events (event_type, device_id, details) VALUES (?, ?, ?)",
            ("snapshot_create", device_id, json.dumps({"name": name})),
        )
        await db.commit()
    finally:
        await db.close()
    return {"message": msg}


@app.delete("/api/snapshots/{name}")
async def api_delete_snapshot(name: str):
    ok = await delete_snapshot(name)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to delete snapshot")
    return {"message": "Snapshot deleted"}


# --- WebSocket: ADB Terminal ---


@app.websocket("/ws/terminal/{device_id}")
async def ws_terminal(websocket: WebSocket, device_id: str):
    await websocket.accept()
    serial = _get_serial(device_id)
    conn = None
    try:
        conn, process = await create_adb_shell_session(serial)

        async def read_output():
            try:
                while True:
                    data = await process.stdout.read(4096)
                    if not data:
                        break
                    await websocket.send_text(data.decode("utf-8", errors="replace"))
            except Exception:
                pass

        read_task = asyncio.create_task(read_output())

        try:
            while True:
                text = await websocket.receive_text()
                process.stdin.write(text.encode("utf-8"))
        except WebSocketDisconnect:
            pass
        finally:
            read_task.cancel()
    except Exception as e:
        try:
            await websocket.send_text(f"\r\nError: {e}\r\n")
        except Exception:
            pass
    finally:
        if conn:
            conn.close()


# --- WebSocket: Logcat ---


@app.websocket("/ws/logcat/{device_id}")
async def ws_logcat(websocket: WebSocket, device_id: str):
    await websocket.accept()
    serial = _get_serial(device_id)
    conn = None
    try:
        filter_tag = ""
        # Try to get filter from query params
        conn, process = await create_logcat_session(serial, filter_tag)

        async def read_output():
            try:
                while True:
                    data = await process.stdout.read(4096)
                    if not data:
                        break
                    await websocket.send_text(data.decode("utf-8", errors="replace"))
            except Exception:
                pass

        read_task = asyncio.create_task(read_output())

        try:
            while True:
                msg = await websocket.receive_text()
                # Client can send filter commands
                if msg.startswith("FILTER:"):
                    pass  # Could implement dynamic filtering
        except WebSocketDisconnect:
            pass
        finally:
            read_task.cancel()
    except Exception as e:
        try:
            await websocket.send_text(f"Error: {e}\n")
        except Exception:
            pass
    finally:
        if conn:
            conn.close()


# --- Device Health Monitoring ---


@app.get("/api/devices/{device_id}/health")
async def device_health(device_id: str):
    serial = _get_serial(device_id)
    health = await get_device_health(serial)
    return health


@app.get("/api/devices/{device_id}/processes")
async def device_processes(device_id: str):
    serial = _get_serial(device_id)
    procs = await get_device_processes(serial)
    return {"processes": procs}


# --- GPS Location Simulation ---


@app.post("/api/devices/{device_id}/gps")
async def device_set_gps(device_id: str, body: dict):
    serial = _get_serial(device_id)
    lat = body.get("latitude", 0.0)
    lng = body.get("longitude", 0.0)
    alt = body.get("altitude", 0.0)
    ok = await set_gps_location(serial, lat, lng, alt)
    return {"success": ok, "message": "GPS location set" if ok else "Failed to set GPS"}


@app.get("/api/gps-presets")
async def gps_presets():
    return {"presets": [
        {"name": "New York City", "latitude": 40.7128, "longitude": -74.0060},
        {"name": "San Francisco", "latitude": 37.7749, "longitude": -122.4194},
        {"name": "London", "latitude": 51.5074, "longitude": -0.1278},
        {"name": "Tokyo", "latitude": 35.6762, "longitude": 139.6503},
        {"name": "Paris", "latitude": 48.8566, "longitude": 2.3522},
        {"name": "Sydney", "latitude": -33.8688, "longitude": 151.2093},
        {"name": "Dubai", "latitude": 25.2048, "longitude": 55.2708},
        {"name": "Mumbai", "latitude": 19.0760, "longitude": 72.8777},
        {"name": "Berlin", "latitude": 52.5200, "longitude": 13.4050},
        {"name": "Seoul", "latitude": 37.5665, "longitude": 126.9780},
    ]}


# --- SMS/Call Simulation ---


@app.post("/api/devices/{device_id}/sms")
async def device_send_sms(device_id: str, body: dict):
    serial = _get_serial(device_id)
    phone = body.get("phone_number", "+15551234567")
    message = body.get("message", "Test SMS")
    ok = await send_sms(serial, phone, message)
    return {"success": ok, "message": "SMS sent" if ok else "Failed to send SMS"}


@app.post("/api/devices/{device_id}/call")
async def device_make_call(device_id: str, body: dict):
    serial = _get_serial(device_id)
    phone = body.get("phone_number", "+15551234567")
    action = body.get("action", "call")
    if action == "call":
        ok = await make_call(serial, phone)
        return {"success": ok, "message": "Call initiated" if ok else "Failed"}
    elif action == "end":
        ok = await end_call(serial, phone)
        return {"success": ok, "message": "Call ended" if ok else "Failed"}
    return {"success": False, "message": "Unknown action"}


# --- Locale Switching ---


@app.get("/api/devices/{device_id}/locale")
async def device_get_locale(device_id: str):
    serial = _get_serial(device_id)
    locale = await get_device_locale(serial)
    return {"locale": locale}


@app.post("/api/devices/{device_id}/locale")
async def device_set_locale(device_id: str, body: dict):
    serial = _get_serial(device_id)
    locale = body.get("locale", "en-US")
    ok = await set_device_locale(serial, locale)
    return {"success": ok, "message": f"Locale set to {locale}" if ok else "Failed"}


@app.get("/api/locales")
async def list_locales():
    return {"locales": [
        {"code": "en-US", "name": "English (US)", "flag": "us"},
        {"code": "en-GB", "name": "English (UK)", "flag": "gb"},
        {"code": "fr-FR", "name": "French", "flag": "fr"},
        {"code": "de-DE", "name": "German", "flag": "de"},
        {"code": "es-ES", "name": "Spanish", "flag": "es"},
        {"code": "it-IT", "name": "Italian", "flag": "it"},
        {"code": "pt-BR", "name": "Portuguese (Brazil)", "flag": "br"},
        {"code": "ja-JP", "name": "Japanese", "flag": "jp"},
        {"code": "ko-KR", "name": "Korean", "flag": "kr"},
        {"code": "zh-CN", "name": "Chinese (Simplified)", "flag": "cn"},
        {"code": "zh-TW", "name": "Chinese (Traditional)", "flag": "tw"},
        {"code": "ar-SA", "name": "Arabic", "flag": "sa"},
        {"code": "hi-IN", "name": "Hindi", "flag": "in"},
        {"code": "ru-RU", "name": "Russian", "flag": "ru"},
        {"code": "tr-TR", "name": "Turkish", "flag": "tr"},
        {"code": "th-TH", "name": "Thai", "flag": "th"},
        {"code": "vi-VN", "name": "Vietnamese", "flag": "vn"},
        {"code": "nl-NL", "name": "Dutch", "flag": "nl"},
        {"code": "sv-SE", "name": "Swedish", "flag": "se"},
        {"code": "pl-PL", "name": "Polish", "flag": "pl"},
    ]}


# --- Device Pools & Tags ---


@app.get("/api/pools")
async def list_pools():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM device_pools ORDER BY name")
        pools = [dict(r) for r in await cursor.fetchall()]
        for pool in pools:
            cursor = await db.execute("SELECT device_id FROM device_pool_members WHERE pool_id = ?", (pool["id"],))
            pool["devices"] = [r[0] for r in await cursor.fetchall()]
        return {"pools": pools}
    finally:
        await db.close()


@app.post("/api/pools")
async def create_pool(body: dict):
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO device_pools (name, description, color) VALUES (?, ?, ?)",
            (body.get("name", ""), body.get("description", ""), body.get("color", "#3b82f6")),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "message": "Pool created"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await db.close()


@app.delete("/api/pools/{pool_id}")
async def delete_pool(pool_id: int):
    db = await get_db()
    try:
        await db.execute("DELETE FROM device_pools WHERE id = ?", (pool_id,))
        await db.commit()
        return {"message": "Pool deleted"}
    finally:
        await db.close()


@app.post("/api/pools/{pool_id}/devices")
async def add_device_to_pool(pool_id: int, body: dict):
    db = await get_db()
    try:
        await db.execute(
            "INSERT OR IGNORE INTO device_pool_members (pool_id, device_id) VALUES (?, ?)",
            (pool_id, body.get("device_id", "")),
        )
        await db.commit()
        return {"message": "Device added to pool"}
    finally:
        await db.close()


@app.delete("/api/pools/{pool_id}/devices/{device_id}")
async def remove_device_from_pool(pool_id: int, device_id: str):
    db = await get_db()
    try:
        await db.execute(
            "DELETE FROM device_pool_members WHERE pool_id = ? AND device_id = ?",
            (pool_id, device_id),
        )
        await db.commit()
        return {"message": "Device removed from pool"}
    finally:
        await db.close()


# --- Device Tags ---


@app.get("/api/devices/{device_id}/tags")
async def device_get_tags(device_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT tag, color FROM device_tags WHERE device_id = ?", (device_id,))
        tags = [{"tag": r[0], "color": r[1]} for r in await cursor.fetchall()]
        return {"tags": tags}
    finally:
        await db.close()


@app.post("/api/devices/{device_id}/tags")
async def device_add_tag(device_id: str, body: dict):
    db = await get_db()
    try:
        await db.execute(
            "INSERT OR IGNORE INTO device_tags (device_id, tag, color) VALUES (?, ?, ?)",
            (device_id, body.get("tag", ""), body.get("color", "#3b82f6")),
        )
        await db.commit()
        return {"message": "Tag added"}
    finally:
        await db.close()


@app.delete("/api/devices/{device_id}/tags/{tag}")
async def device_remove_tag(device_id: str, tag: str):
    db = await get_db()
    try:
        await db.execute("DELETE FROM device_tags WHERE device_id = ? AND tag = ?", (device_id, tag))
        await db.commit()
        return {"message": "Tag removed"}
    finally:
        await db.close()


# --- Device Scheduling ---


@app.get("/api/schedules")
async def list_schedules():
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT ds.*, u.username FROM device_schedules ds LEFT JOIN users u ON ds.user_id = u.id ORDER BY ds.start_time"
        )
        return {"schedules": [dict(r) for r in await cursor.fetchall()]}
    finally:
        await db.close()


@app.post("/api/schedules")
async def create_schedule(body: dict):
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO device_schedules (device_id, user_id, title, start_time, end_time) VALUES (?, ?, ?, ?, ?)",
            (body.get("device_id", ""), body.get("user_id", 1), body.get("title", ""), body.get("start_time", ""), body.get("end_time", "")),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "message": "Schedule created"}
    finally:
        await db.close()


@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule(schedule_id: int):
    db = await get_db()
    try:
        await db.execute("DELETE FROM device_schedules WHERE id = ?", (schedule_id,))
        await db.commit()
        return {"message": "Schedule deleted"}
    finally:
        await db.close()


# --- Cost Tracking ---


@app.get("/api/usage")
async def list_usage_sessions(device_id: str = None):
    db = await get_db()
    try:
        if device_id:
            cursor = await db.execute(
                "SELECT * FROM usage_sessions WHERE device_id = ? ORDER BY started_at DESC LIMIT 100",
                (device_id,),
            )
        else:
            cursor = await db.execute("SELECT * FROM usage_sessions ORDER BY started_at DESC LIMIT 100")
        sessions = [dict(r) for r in await cursor.fetchall()]
        total_cost = sum(s.get("cost_cents", 0) for s in sessions)
        total_hours = sum(s.get("duration_seconds", 0) for s in sessions) / 3600
        return {"sessions": sessions, "total_cost_cents": total_cost, "total_hours": round(total_hours, 2)}
    finally:
        await db.close()


@app.post("/api/usage/start")
async def start_usage_session(body: dict):
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO usage_sessions (device_id, user_id) VALUES (?, ?)",
            (body.get("device_id", ""), body.get("user_id")),
        )
        await db.commit()
        return {"session_id": cursor.lastrowid}
    finally:
        await db.close()


@app.post("/api/usage/{session_id}/end")
async def end_usage_session(session_id: int):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT started_at FROM usage_sessions WHERE id = ?", (session_id,))
        row = await cursor.fetchone()
        if row:
            started = row[0]
            now = datetime.now(timezone.utc).isoformat()
            from datetime import datetime as dt
            try:
                start_dt = dt.fromisoformat(started.replace("Z", "+00:00"))
                end_dt = dt.fromisoformat(now.replace("Z", "+00:00"))
                dur = int((end_dt - start_dt).total_seconds())
            except Exception:
                dur = 0
            cost = max(1, dur // 60)  # 1 cent per minute
            await db.execute(
                "UPDATE usage_sessions SET ended_at = ?, duration_seconds = ?, cost_cents = ? WHERE id = ?",
                (now, dur, cost, session_id),
            )
            await db.commit()
        return {"message": "Session ended"}
    finally:
        await db.close()


# --- Webhooks ---


@app.get("/api/webhooks")
async def list_webhooks():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM webhooks ORDER BY created_at DESC")
        return {"webhooks": [dict(r) for r in await cursor.fetchall()]}
    finally:
        await db.close()


@app.post("/api/webhooks")
async def create_webhook(body: dict):
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO webhooks (name, url, events, secret) VALUES (?, ?, ?, ?)",
            (body.get("name", ""), body.get("url", ""), json.dumps(body.get("events", ["device.created"])), body.get("secret", "")),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "message": "Webhook created"}
    finally:
        await db.close()


@app.delete("/api/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: int):
    db = await get_db()
    try:
        await db.execute("DELETE FROM webhooks WHERE id = ?", (webhook_id,))
        await db.commit()
        return {"message": "Webhook deleted"}
    finally:
        await db.close()


@app.put("/api/webhooks/{webhook_id}/toggle")
async def toggle_webhook(webhook_id: int):
    db = await get_db()
    try:
        await db.execute("UPDATE webhooks SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?", (webhook_id,))
        await db.commit()
        return {"message": "Webhook toggled"}
    finally:
        await db.close()


# --- Screenshot Comparison ---


@app.post("/api/devices/{device_id}/screenshot-compare")
async def screenshot_compare(device_id: str, body: dict):
    serial_a = _get_serial(device_id)
    other_device_id = body.get("other_device_id", "")
    if not other_device_id:
        raise HTTPException(status_code=400, detail="other_device_id required")
    serial_b = _get_serial(other_device_id)
    img_a = await take_screenshot_for_comparison(serial_a)
    img_b = await take_screenshot_for_comparison(serial_b)
    name = body.get("name", f"compare_{device_id}_{other_device_id}")
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO screenshot_comparisons (name, device_id_a, device_id_b, screenshot_a, screenshot_b) VALUES (?, ?, ?, ?, ?)",
            (name, device_id, other_device_id, img_a or "", img_b or ""),
        )
        await db.commit()
    finally:
        await db.close()
    return {"screenshot_a": img_a, "screenshot_b": img_b, "name": name}


@app.get("/api/screenshot-comparisons")
async def list_screenshot_comparisons():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id, name, device_id_a, device_id_b, created_at FROM screenshot_comparisons ORDER BY created_at DESC LIMIT 20")
        return {"comparisons": [dict(r) for r in await cursor.fetchall()]}
    finally:
        await db.close()


# --- Remote Debugging ---


@app.get("/api/devices/{device_id}/debug-info")
async def device_debug_info(device_id: str):
    serial = _get_serial(device_id)
    url = await get_webview_debug_url(serial)
    iid = int(device_id.replace("cvd-", ""))
    adb_port = 6520 + iid - 1
    return {
        "adb_connect": f"adb connect {PUBLIC_IP}:{adb_port}",
        "chrome_inspect": url or "chrome://inspect/#devices",
        "adb_forward": f"adb -s {PUBLIC_IP}:{adb_port} forward tcp:9222 localabstract:chrome_devtools_remote",
        "webrtc_url": f"https://{PUBLIC_IP}:8443",
    }


# --- Automated Testing ---


@app.post("/api/devices/{device_id}/test/monkey")
async def device_monkey_test(device_id: str, body: dict):
    serial = _get_serial(device_id)
    package = body.get("package", "")
    event_count = body.get("event_count", 500)
    if not package:
        raise HTTPException(status_code=400, detail="package required")
    success, output = await run_monkey_test(serial, package, event_count)
    # Log analytics
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO analytics_events (event_type, device_id, details) VALUES (?, ?, ?)",
            ("monkey_test", device_id, json.dumps({"package": package, "events": event_count, "passed": success})),
        )
        await db.commit()
    finally:
        await db.close()
    return {"success": success, "output": output}


# --- Session Recording & Playback ---


@app.post("/api/devices/{device_id}/input-recording/start")
async def device_start_input_recording(device_id: str):
    serial = _get_serial(device_id)
    ok = await start_input_recording(serial)
    return {"success": ok, "message": "Input recording started" if ok else "Failed"}


@app.post("/api/devices/{device_id}/input-recording/stop")
async def device_stop_input_recording(device_id: str):
    serial = _get_serial(device_id)
    ok = await stop_input_recording(serial)
    return {"success": ok, "message": "Input recording stopped"}


@app.get("/api/devices/{device_id}/input-recording")
async def device_get_input_recording(device_id: str):
    serial = _get_serial(device_id)
    events = await get_input_recording(serial)
    return {"events": events, "line_count": len(events.strip().split('\n')) if events.strip() else 0}


@app.post("/api/devices/{device_id}/input-recording/replay")
async def device_replay_input_recording(device_id: str, body: dict):
    serial = _get_serial(device_id)
    events = body.get("events", "")
    if not events:
        raise HTTPException(status_code=400, detail="events data required")
    ok = await replay_input_recording(serial, events)
    return {"success": ok, "message": "Replay completed" if ok else "No valid events to replay"}


# Stored session recordings in DB
@app.get("/api/session-recordings")
async def list_session_recordings():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM session_recordings ORDER BY created_at DESC LIMIT 50")
        return {"recordings": [dict(r) for r in await cursor.fetchall()]}
    finally:
        await db.close()


@app.post("/api/session-recordings")
async def save_session_recording(body: dict):
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO session_recordings (name, device_id, events_data, duration_seconds) VALUES (?, ?, ?, ?)",
            (body.get("name", "Untitled"), body.get("device_id", ""), body.get("events_data", ""), body.get("duration_seconds", 0)),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "message": "Recording saved"}
    finally:
        await db.close()


@app.get("/api/session-recordings/{recording_id}")
async def get_session_recording(recording_id: int):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM session_recordings WHERE id = ?", (recording_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Recording not found")
        return dict(row)
    finally:
        await db.close()


@app.delete("/api/session-recordings/{recording_id}")
async def delete_session_recording(recording_id: int):
    db = await get_db()
    try:
        await db.execute("DELETE FROM session_recordings WHERE id = ?", (recording_id,))
        await db.commit()
        return {"message": "Recording deleted"}
    finally:
        await db.close()


# --- Custom Boot Animations & Branding ---


@app.get("/api/devices/{device_id}/branding")
async def device_get_branding(device_id: str):
    serial = _get_serial(device_id)
    branding = await get_device_branding(serial)
    return branding


@app.post("/api/devices/{device_id}/branding")
async def device_set_branding(device_id: str, body: dict):
    serial = _get_serial(device_id)
    brand = body.get("brand", "")
    model = body.get("model", "")
    manufacturer = body.get("manufacturer", "")
    ok = await set_device_branding(serial, brand, model, manufacturer)
    return {"success": ok, "message": "Branding updated" if ok else "Failed"}


@app.post("/api/devices/{device_id}/boot-animation")
async def device_set_boot_animation(device_id: str, body: dict):
    serial = _get_serial(device_id)
    animation = body.get("animation", "default")
    ok = await set_boot_animation(serial, animation)
    return {"success": ok, "message": f"Boot animation set to {animation}" if ok else "Failed"}


@app.get("/api/boot-animations")
async def list_boot_animations():
    return {"animations": [
        {"id": "default", "name": "Default Android", "description": "Standard AOSP boot animation"},
        {"id": "material", "name": "Material Design", "description": "Google Material-style animation"},
        {"id": "minimal", "name": "Minimal", "description": "Clean, simple boot sequence"},
        {"id": "corporate", "name": "Corporate", "description": "Professional branding animation"},
        {"id": "gaming", "name": "Gaming", "description": "Dynamic gaming-style boot"},
        {"id": "neon", "name": "Neon", "description": "Cyberpunk neon glow animation"},
        {"id": "nature", "name": "Nature", "description": "Calming nature-themed boot"},
        {"id": "retro", "name": "Retro", "description": "Classic retro computing style"},
    ]}


# --- Plugin / Extension System ---

# In-memory plugin registry
_plugins: dict = {}


@app.get("/api/plugins")
async def list_plugins():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM plugins ORDER BY name")
        plugins = [dict(r) for r in await cursor.fetchall()]
        return {"plugins": plugins}
    finally:
        await db.close()


@app.post("/api/plugins")
async def register_plugin(body: dict):
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO plugins (name, description, version, author, hook_events, config_schema, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                body.get("name", ""),
                body.get("description", ""),
                body.get("version", "1.0.0"),
                body.get("author", ""),
                json.dumps(body.get("hook_events", ["device.created", "device.deleted"])),
                json.dumps(body.get("config_schema", {})),
                1,
            ),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "message": "Plugin registered"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await db.close()


@app.put("/api/plugins/{plugin_id}/toggle")
async def toggle_plugin(plugin_id: int):
    db = await get_db()
    try:
        await db.execute(
            "UPDATE plugins SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END WHERE id = ?",
            (plugin_id,),
        )
        await db.commit()
        return {"message": "Plugin toggled"}
    finally:
        await db.close()


@app.delete("/api/plugins/{plugin_id}")
async def delete_plugin(plugin_id: int):
    db = await get_db()
    try:
        await db.execute("DELETE FROM plugins WHERE id = ?", (plugin_id,))
        await db.commit()
        return {"message": "Plugin deleted"}
    finally:
        await db.close()


@app.put("/api/plugins/{plugin_id}/config")
async def update_plugin_config(plugin_id: int, body: dict):
    db = await get_db()
    try:
        await db.execute(
            "UPDATE plugins SET config_schema = ? WHERE id = ?",
            (json.dumps(body.get("config", {})), plugin_id),
        )
        await db.commit()
        return {"message": "Plugin config updated"}
    finally:
        await db.close()


@app.get("/api/plugin-hooks")
async def list_plugin_hooks():
    """List all available plugin hook events."""
    return {"hooks": [
        {"event": "device.created", "description": "Fired when a new device is created"},
        {"event": "device.deleted", "description": "Fired when a device is deleted"},
        {"event": "device.started", "description": "Fired when a device starts"},
        {"event": "device.stopped", "description": "Fired when a device stops"},
        {"event": "device.error", "description": "Fired when a device encounters an error"},
        {"event": "app.installed", "description": "Fired when an APK is installed"},
        {"event": "app.uninstalled", "description": "Fired when an app is uninstalled"},
        {"event": "test.completed", "description": "Fired when a test run completes"},
        {"event": "snapshot.created", "description": "Fired when a snapshot is created"},
        {"event": "user.login", "description": "Fired when a user logs in"},
        {"event": "schedule.triggered", "description": "Fired when a scheduled event triggers"},
    ]}


# --- Smart Device Recommendations ---


@app.post("/api/recommendations")
async def device_recommendations(body: dict):
    category = body.get("app_category", "social_media")
    audience = body.get("target_audience", "general")
    budget = body.get("budget", "medium")
    recs = get_smart_recommendations(category, audience, budget)
    return {"recommendations": recs}


@app.get("/api/recommendation-options")
async def recommendation_options():
    return {
        "categories": [
            {"id": "social_media", "name": "Social Media", "icon": "message-square"},
            {"id": "gaming", "name": "Gaming", "icon": "gamepad"},
            {"id": "enterprise", "name": "Enterprise / Business", "icon": "briefcase"},
            {"id": "ecommerce", "name": "E-Commerce", "icon": "shopping-cart"},
            {"id": "media", "name": "Media / Streaming", "icon": "play"},
        ],
        "audiences": [
            {"id": "general", "name": "General Users"},
            {"id": "power_users", "name": "Power Users"},
            {"id": "budget", "name": "Budget / Emerging Markets"},
            {"id": "enterprise", "name": "Enterprise / Corporate"},
            {"id": "gaming", "name": "Gamers"},
            {"id": "developers", "name": "Developers"},
        ],
        "budgets": [
            {"id": "low", "name": "Low (1-2 devices)"},
            {"id": "medium", "name": "Medium (3-5 devices)"},
            {"id": "high", "name": "High (6+ devices)"},
        ],
    }


# --- Live Collaboration ---

# WebSocket-based collaboration: multiple users can view/control the same device
_collab_rooms: dict[str, list[WebSocket]] = {}
_collab_cursors: dict[str, dict[str, dict]] = {}  # room -> {user_id: {x, y, color, name}}


@app.websocket("/ws/collab/{device_id}")
async def ws_collaboration(websocket: WebSocket, device_id: str):
    """WebSocket for live collaboration on a device."""
    await websocket.accept()
    room_id = device_id
    if room_id not in _collab_rooms:
        _collab_rooms[room_id] = []
        _collab_cursors[room_id] = {}
    _collab_rooms[room_id].append(websocket)

    # Generate a color for this user
    import random
    colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"]
    user_color = random.choice(colors)
    user_id = f"user_{id(websocket)}"

    try:
        # Notify others that a new user joined
        join_msg = json.dumps({"type": "user_joined", "user_id": user_id, "color": user_color, "count": len(_collab_rooms[room_id])})
        for ws in _collab_rooms[room_id]:
            if ws != websocket:
                try:
                    await ws.send_text(join_msg)
                except Exception:
                    pass

        # Send current user list to new user
        await websocket.send_text(json.dumps({
            "type": "init",
            "user_id": user_id,
            "color": user_color,
            "users": len(_collab_rooms[room_id]),
            "cursors": _collab_cursors.get(room_id, {}),
        }))

        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "cursor_move":
                _collab_cursors.setdefault(room_id, {})[user_id] = {
                    "x": msg.get("x", 0),
                    "y": msg.get("y", 0),
                    "color": user_color,
                    "name": msg.get("name", user_id),
                }
                # Broadcast cursor to others
                broadcast = json.dumps({"type": "cursor_update", "user_id": user_id, "x": msg.get("x", 0), "y": msg.get("y", 0), "color": user_color, "name": msg.get("name", user_id)})
                for ws in _collab_rooms[room_id]:
                    if ws != websocket:
                        try:
                            await ws.send_text(broadcast)
                        except Exception:
                            pass

            elif msg.get("type") == "action":
                # Broadcast actions (clicks, keystrokes) to others
                broadcast = json.dumps({"type": "action", "user_id": user_id, "color": user_color, "action": msg.get("action", ""), "params": msg.get("params", {})})
                for ws in _collab_rooms[room_id]:
                    if ws != websocket:
                        try:
                            await ws.send_text(broadcast)
                        except Exception:
                            pass

            elif msg.get("type") == "chat":
                broadcast = json.dumps({"type": "chat", "user_id": user_id, "color": user_color, "name": msg.get("name", user_id), "message": msg.get("message", "")})
                for ws in _collab_rooms[room_id]:
                    try:
                        await ws.send_text(broadcast)
                    except Exception:
                        pass

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if room_id in _collab_rooms:
            _collab_rooms[room_id] = [ws for ws in _collab_rooms[room_id] if ws != websocket]
            if user_id in _collab_cursors.get(room_id, {}):
                del _collab_cursors[room_id][user_id]
            # Notify others
            leave_msg = json.dumps({"type": "user_left", "user_id": user_id, "count": len(_collab_rooms[room_id])})
            for ws in _collab_rooms[room_id]:
                try:
                    await ws.send_text(leave_msg)
                except Exception:
                    pass
            if not _collab_rooms[room_id]:
                del _collab_rooms[room_id]
                if room_id in _collab_cursors:
                    del _collab_cursors[room_id]


@app.get("/api/collab/{device_id}/users")
async def collab_users(device_id: str):
    room_id = device_id
    count = len(_collab_rooms.get(room_id, []))
    cursors = _collab_cursors.get(room_id, {})
    return {"users": count, "cursors": cursors}


# --- Server Status ---


@app.get("/api/server/status", response_model=ServerStatus)
async def server_status():
    """Get server resource usage."""
    status = await get_server_status()
    return ServerStatus(**status)


# --- Serve Frontend Static Files ---
STATIC_DIR = Path(__file__).parent.parent / "static"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend SPA for all non-API routes."""
        file_path = STATIC_DIR / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))
