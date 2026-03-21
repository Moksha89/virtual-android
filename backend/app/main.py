from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import os
import json
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
