from fastapi import FastAPI, WebSocket, HTTPException, Request, Depends, UploadFile
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
from dotenv import load_dotenv
import logging
import asyncio
import time
from datetime import datetime
import shutil

from app.docker_manager import DockerManager
from app.webrtc_signaling import WebRTCSignaling
from app.database import get_db, User, DeviceAssignment, engine
from app.auth import (
    hash_password, verify_password, create_access_token, 
    get_current_user, get_current_admin_user, create_default_admin
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/tmp/virtual-android-backend.log')
    ]
)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Virtual Android API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    logger.info(f"Request: {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(f"Response: {request.method} {request.url.path} - Status: {response.status_code} - Time: {process_time:.3f}s")
        return response
    except Exception as e:
        logger.error(f"Request failed: {request.method} {request.url.path} - Error: {str(e)}", exc_info=True)
        raise

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

docker_manager = DockerManager(
    docker_host=os.getenv("DOCKER_HOST", "ssh://administrator@155.117.44.194")
)
webrtc_signaling = WebRTCSignaling()


@app.on_event("startup")
async def startup_event():
    db = next(get_db())
    admin = create_default_admin(db)
    
    if admin and admin.username == "admin":
        if verify_password("admin123", admin.password_hash):
            logger.warning("=" * 80)
            logger.warning("⚠️  SECURITY WARNING: Default admin password is still in use!")
            logger.warning("⚠️  Please change it immediately via the admin dashboard or API")
            logger.warning("⚠️  Endpoint: POST /api/auth/change-password")
            logger.warning("=" * 80)
        else:
            logger.info(f"Default admin user exists with custom password")


class CreateInstanceRequest(BaseModel):
    ram_gb: int = 4
    rom_gb: int = 32


class InstanceResponse(BaseModel):
    id: str
    container_id: str
    container_name: str
    ram_gb: int
    rom_gb: int
    adb_port: str
    status: str


class InputEventRequest(BaseModel):
    x: float
    y: float
    type: str = "tap"


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    created_at: str


class AssignDeviceRequest(BaseModel):
    user_id: int


class KeyEventRequest(BaseModel):
    keycode: int
    key_name: str


@app.post("/api/auth/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(request: Request, login_request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_request.username).first()
    
    if not user or not verify_password(login_request.password, user.password_hash):
        logger.warning(f"Failed login attempt for username: {login_request.username} from {get_remote_address(request)}")
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token, expires_at = create_access_token(user.id, user.username, user.role)
    
    logger.info(f"Successful login: {user.username} (role: {user.role})")
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    }


@app.post("/api/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully"}


@app.get("/api/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role
    }

@app.post("/api/auth/change-password")
async def change_password(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    body = await request.json()
    old_password = body.get("old_password")
    new_password = body.get("new_password")
    
    if not old_password or not new_password:
        raise HTTPException(status_code=400, detail="old_password and new_password are required")
    
    if not verify_password(old_password, current_user.password_hash):
        logger.warning(f"Failed password change attempt for user: {current_user.username}")
        raise HTTPException(status_code=401, detail="Invalid current password")
    
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    current_user.password_hash = hash_password(new_password)
    db.commit()
    
    logger.info(f"Password changed for user: {current_user.username}")
    return {"message": "Password changed successfully"}



@app.post("/api/admin/users", response_model=UserResponse)
async def create_user(
    request: CreateUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    existing = db.query(User).filter(
        (User.username == request.username) | (User.email == request.email)
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    new_user = User(
        username=request.username,
        email=request.email,
        password_hash=hash_password(request.password),
        role=request.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        role=new_user.role,
        created_at=new_user.created_at.isoformat()
    )


@app.get("/api/admin/users")
async def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    users = db.query(User).all()
    return [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at.isoformat()
        }
        for user in users
    ]


@app.get("/api/admin/users/{user_id}")
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "created_at": user.created_at.isoformat()
    }


@app.delete("/api/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    db.delete(user)
    db.commit()
    
    return {"message": "User deleted successfully"}


@app.post("/api/admin/devices/{instance_id}/assign")
async def assign_device(
    instance_id: str,
    request: AssignDeviceRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    instance = docker_manager.get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Device not found")
    
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = db.query(DeviceAssignment).filter(
        DeviceAssignment.device_instance_id == instance_id,
        DeviceAssignment.user_id == request.user_id
    ).first()
    
    if existing:
        return {"message": "Device already assigned to this user"}
    
    assignment = DeviceAssignment(
        device_instance_id=instance_id,
        user_id=request.user_id
    )
    db.add(assignment)
    db.commit()
    
    return {"message": "Device assigned successfully"}


@app.delete("/api/admin/devices/{instance_id}/assign")
async def unassign_device(
    instance_id: str,
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    assignment = db.query(DeviceAssignment).filter(
        DeviceAssignment.device_instance_id == instance_id,
        DeviceAssignment.user_id == user_id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Device assignment not found")
    
    db.delete(assignment)
    db.commit()
    
    return {"message": "Device unassigned successfully"}


@app.get("/api/admin/devices")
async def list_all_devices(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    instances = docker_manager.list_instances()
    
    result = []
    for instance in instances:
        assignments = db.query(DeviceAssignment).filter(
            DeviceAssignment.device_instance_id == instance["id"]
        ).all()
        
        device_info = {
            **instance,
            "assigned_to": []
        }
        
        for assignment in assignments:
            user = db.query(User).filter(User.id == assignment.user_id).first()
            if user:
                device_info["assigned_to"].append({
                    "user_id": user.id,
                    "username": user.username,
                    "assigned_at": assignment.assigned_at.isoformat()
                })
        
        if not device_info["assigned_to"]:
            device_info["assigned_to"] = None
        
        result.append(device_info)
    
    return result


@app.get("/api/admin/monitor")
async def get_monitoring_data(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    return await list_all_devices(db, admin)


@app.get("/api/user/devices")
async def list_user_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "admin":
        return docker_manager.list_instances()
    
    assignments = db.query(DeviceAssignment).filter(
        DeviceAssignment.user_id == current_user.id
    ).all()
    
    instance_ids = [a.device_instance_id for a in assignments]
    all_instances = docker_manager.list_instances()
    
    user_instances = [
        instance for instance in all_instances 
        if instance["id"] in instance_ids
    ]
    
    return user_instances


@app.get("/api/user/devices/{instance_id}")
async def get_user_device(
    instance_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    def check_device_access(instance_id: str, user: User, db: Session):
        if user.role == "admin":
            return True
        
        assignment = db.query(DeviceAssignment).filter(
            DeviceAssignment.device_instance_id == instance_id,
            DeviceAssignment.user_id == user.id
        ).first()
        
        if not assignment:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this device"
            )
        
        return True
    
    check_device_access(instance_id, current_user, db)
    
    instance = docker_manager.get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    return instance


@app.post("/api/instances", response_model=InstanceResponse)
async def create_instance(
    request: CreateInstanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create a new Android instance with specified RAM and ROM."""
    if request.ram_gb not in [2, 4, 8]:
        raise HTTPException(status_code=400, detail="RAM must be 2, 4, or 8 GB")
    if request.rom_gb not in [16, 32, 64]:
        raise HTTPException(status_code=400, detail="ROM must be 16, 32, or 64 GB")
    
    try:
        instance = await docker_manager.create_instance(request.ram_gb, request.rom_gb)
        return instance
    except Exception as e:
        logger.error(f"Failed to create instance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/instances")
async def list_instances():
    """List all active Android instances."""
    return docker_manager.list_instances()


@app.get("/api/instances/{instance_id}", response_model=InstanceResponse)
async def get_instance(instance_id: str):
    """Get information about a specific instance."""
    instance = docker_manager.get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    return instance


@app.delete("/api/instances/{instance_id}")
async def delete_instance(instance_id: str):
    """Delete an Android instance."""
    success = await docker_manager.delete_instance(instance_id)
    if not success:
        raise HTTPException(status_code=404, detail="Instance not found")
    return {"message": "Instance deleted successfully"}


@app.post("/api/instances/{instance_id}/input")
async def send_input_event(
    instance_id: str,
    request: InputEventRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send touch input event to an Android instance."""
    def check_device_access(instance_id: str, user: User, db: Session):
        if user.role == "admin":
            return True
        
        assignment = db.query(DeviceAssignment).filter(
            DeviceAssignment.device_instance_id == instance_id,
            DeviceAssignment.user_id == user.id
        ).first()
        
        if not assignment:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this device"
            )
        
        return True
    
    check_device_access(instance_id, current_user, db)
    
    try:
        await docker_manager.send_input_event(
            instance_id,
            request.x,
            request.y,
            request.type
        )
        return {"message": "Input event sent successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to send input event: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/instances/{instance_id}/camera")
async def stream_camera(
    instance_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Receive camera stream from browser and forward to Android."""
    def check_device_access(instance_id: str, user: User, db: Session):
        if user.role == "admin":
            return True
        
        assignment = db.query(DeviceAssignment).filter(
            DeviceAssignment.device_instance_id == instance_id,
            DeviceAssignment.user_id == user.id
        ).first()
        
        if not assignment:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this device"
            )
        
        return True
    
    check_device_access(instance_id, current_user, db)
    
    from app.camera_manager import camera_manager
    
    try:
        frame_data = await request.body()
        
        await camera_manager.start_camera_stream(instance_id, frame_data)
        
        return {"message": "Camera frame received"}
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to stream camera: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/api/instances/{instance_id}/webrtc")
async def webrtc_endpoint(websocket: WebSocket, instance_id: str):
    """WebRTC signaling endpoint for screen streaming."""
    instance = docker_manager.get_instance(instance_id)
    if not instance:
        await websocket.close(code=1008, reason="Instance not found")
        return
    
    await webrtc_signaling.handle_websocket(websocket, instance_id)


@app.post("/api/instances/{instance_id}/keyevent")
async def send_key_event(
    instance_id: str,
    request: KeyEventRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send hardware key event to Android instance."""
    def check_device_access(instance_id: str, user: User, db: Session):
        if user.role == "admin":
            return True
        
        assignment = db.query(DeviceAssignment).filter(
            DeviceAssignment.device_instance_id == instance_id,
            DeviceAssignment.user_id == user.id
        ).first()
        
        if not assignment:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this device"
            )
        
        return True
    
    check_device_access(instance_id, current_user, db)
    
    try:
        instance = docker_manager.get_instance(instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        container = await asyncio.to_thread(
            docker_manager.client.containers.get,
            instance["container_id"]
        )
        
        result = await asyncio.to_thread(
            container.exec_run,
            cmd=f"sh -c 'input keyevent {request.keycode}'"
        )
        
        logger.debug(f"Sent keyevent {request.key_name} ({request.keycode}) to {instance_id}")
        
        return {"message": f"Key event {request.key_name} sent successfully"}
        
    except Exception as e:
        logger.error(f"Failed to send key event to {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/instances/{instance_id}/call")
async def make_call(instance_id: str, to_number: str):
    """Make outbound call from Android instance."""
    from app.voip_manager import voip_manager
    
    if not voip_manager.enabled:
        raise HTTPException(status_code=503, detail="VoIP not configured")
    
    try:
        call_sid = await voip_manager.make_call(instance_id, to_number)
        return {"call_sid": call_sid, "status": "initiated"}
    except Exception as e:
        logger.error(f"Failed to make call: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/instances/{instance_id}/sms")
async def send_sms(instance_id: str, to_number: str, message: str):
    """Send SMS from Android instance."""
    from app.voip_manager import voip_manager
    
    if not voip_manager.enabled:
        raise HTTPException(status_code=503, detail="VoIP not configured")
    
    try:
        sms_sid = await voip_manager.send_sms(instance_id, to_number, message)
        return {"sms_sid": sms_sid, "status": "sent"}
    except Exception as e:
        logger.error(f"Failed to send SMS: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/voip/call-webhook")
async def call_webhook(request: Request):
    """Handle incoming call webhook from Twilio."""
    from app.voip_manager import voip_manager
    
    form_data = await request.form()
    instance_id = request.query_params.get("instance")
    
    response = voip_manager.handle_incoming_call(instance_id)
    return Response(content=response, media_type="application/xml")


@app.post("/voip/sms-webhook")
async def sms_webhook(request: Request):
    """Handle incoming SMS webhook from Twilio."""
    from app.voip_manager import voip_manager
    
    form_data = await request.form()
    instance_id = request.query_params.get("instance")
    from_number = form_data.get("From")
    body = form_data.get("Body")
    
    response = voip_manager.handle_incoming_sms(instance_id, from_number, body)
    return Response(content=response, media_type="application/xml")


@app.post("/api/instances/{instance_id}/upload")
@limiter.limit("30/minute")
async def upload_file(
    request: Request,
    instance_id: str,
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload file to Android device."""
    assignment = db.query(DeviceAssignment).filter(
        DeviceAssignment.device_instance_id == instance_id,
        DeviceAssignment.user_id == current_user.id
    ).first()
    
    if not assignment and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    instance = docker_manager.get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    try:
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        adb_port = instance["adb_port"]
        android_path = f"/sdcard/Download/{file.filename}"
        
        process = await asyncio.create_subprocess_exec(
            "adb", "-s", f"localhost:{adb_port}",
            "push", tmp_path, android_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        os.unlink(tmp_path)
        
        if process.returncode != 0:
            raise HTTPException(status_code=500, detail=f"ADB push failed: {stderr.decode()}")
        
        logger.info(f"File uploaded to {instance_id}: {file.filename}")
        return {"message": "File uploaded successfully", "path": android_path}
        
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/instances/{instance_id}/files")
@limiter.limit("60/minute")
async def list_files(
    request: Request,
    instance_id: str,
    path: str = "/sdcard/Download",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List files on Android device."""
    assignment = db.query(DeviceAssignment).filter(
        DeviceAssignment.device_instance_id == instance_id,
        DeviceAssignment.user_id == current_user.id
    ).first()
    
    if not assignment and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    instance = docker_manager.get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    try:
        adb_port = instance["adb_port"]
        
        process = await asyncio.create_subprocess_exec(
            "adb", "-s", f"localhost:{adb_port}",
            "shell", f"ls -la {path}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Failed to list files: {stderr.decode()}")
        
        files = []
        for line in stdout.decode().split('\n'):
            if line.strip() and not line.startswith('total'):
                files.append(line.strip())
        
        return {"files": files}
        
    except Exception as e:
        logger.error(f"Failed to list files: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/instances/{instance_id}/download/{filename}")
@limiter.limit("30/minute")
async def download_file(
    request: Request,
    instance_id: str,
    filename: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download file from Android device."""
    assignment = db.query(DeviceAssignment).filter(
        DeviceAssignment.device_instance_id == instance_id,
        DeviceAssignment.user_id == current_user.id
    ).first()
    
    if not assignment and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    instance = docker_manager.get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    try:
        import tempfile
        adb_port = instance["adb_port"]
        android_path = f"/sdcard/Download/{filename}"
        
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        
        process = await asyncio.create_subprocess_exec(
            "adb", "-s", f"localhost:{adb_port}",
            "pull", android_path, tmp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            os.unlink(tmp_path)
            raise HTTPException(status_code=500, detail=f"ADB pull failed: {stderr.decode()}")
        
        with open(tmp_path, 'rb') as f:
            content = f.read()
        
        os.unlink(tmp_path)
        
        return Response(
            content=content,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"File download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/api/health")
async def health_check(db: Session = Depends(get_db)):
    """Comprehensive health check endpoint."""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {}
    }
    
    try:
        db.execute(text("SELECT 1"))
        health_status["checks"]["database"] = {"status": "healthy", "message": "Database connection successful"}
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["database"] = {"status": "unhealthy", "message": str(e)}
        logger.error(f"Database health check failed: {e}")
    
    try:
        docker_manager.client.ping()
        health_status["checks"]["docker"] = {"status": "healthy", "message": "Docker connection successful"}
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["docker"] = {"status": "unhealthy", "message": str(e)}
        logger.error(f"Docker health check failed: {e}")
    
    try:
        total, used, free = shutil.disk_usage("/")
        free_gb = free // (2**30)
        health_status["checks"]["disk"] = {
            "status": "healthy" if free_gb > 10 else "warning",
            "free_gb": free_gb,
            "total_gb": total // (2**30)
        }
        if free_gb < 10:
            logger.warning(f"Low disk space: {free_gb}GB free")
    except Exception as e:
        health_status["checks"]["disk"] = {"status": "unknown", "message": str(e)}
    
    health_status["checks"]["instances"] = {
        "count": len(docker_manager.list_instances()),
        "status": "healthy"
    }
    
    if health_status["status"] == "unhealthy":
        return JSONResponse(status_code=503, content=health_status)
    
    return health_status


@app.get("/")
async def root():
    return {
        "message": "Virtual Android API",
        "status": "running",
        "version": "1.0.0"
    }
