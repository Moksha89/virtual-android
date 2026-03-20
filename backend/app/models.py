from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class DeviceStatus(str, Enum):
    RUNNING = "running"
    STARTING = "starting"
    STOPPED = "stopped"
    ERROR = "error"


class HardwareProfile(BaseModel):
    id: str
    name: str
    brand: str
    category: str = "flagship"  # flagship, mid-range, tablet, custom
    x_res: int = 1080
    y_res: int = 2400
    dpi: int = 420
    default_ram_mb: int = 8192
    default_storage_gb: int = 128
    default_cpus: int = 4
    description: str = ""
    icon: str = "smartphone"  # lucide icon name
    is_custom: bool = False


class CreateDeviceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    profile_id: str
    android_version: str = "14"
    os_type: str = "aosp"
    ram_mb: int = Field(default=4096, ge=1024, le=65536)
    storage_gb: int = Field(default=64, ge=8, le=512)
    cpus: int = Field(default=4, ge=1, le=16)
    gpu_mode: str = "guest_swiftshader"


class EditDeviceRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    ram_mb: Optional[int] = Field(None, ge=1024, le=65536)
    storage_gb: Optional[int] = Field(None, ge=8, le=512)
    cpus: Optional[int] = Field(None, ge=1, le=16)


class CreateProfileRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    brand: str = Field(default="Custom")
    category: str = "custom"
    x_res: int = Field(default=1080, ge=320, le=3840)
    y_res: int = Field(default=2400, ge=480, le=3840)
    dpi: int = Field(default=420, ge=120, le=640)
    default_ram_mb: int = Field(default=8192, ge=1024, le=65536)
    default_storage_gb: int = Field(default=128, ge=8, le=512)
    default_cpus: int = Field(default=4, ge=1, le=16)
    description: str = ""


class DeviceInfo(BaseModel):
    id: str
    name: str
    instance_id: int
    profile_id: str
    profile_name: str
    android_version: str
    os_type: str = "aosp"
    status: DeviceStatus
    ram_mb: int
    storage_gb: int
    cpus: int
    x_res: int
    y_res: int
    dpi: int
    gpu_mode: str
    adb_port: int
    webrtc_port: int
    adb_serial: str
    ip: str
    assigned_users: list[str] = []


class ServerStatus(BaseModel):
    cpu_cores: int
    cpu_usage_percent: float
    ram_total_gb: float
    ram_used_gb: float
    ram_available_gb: float
    disk_total_gb: float
    disk_used_gb: float
    disk_available_gb: float
    gpu_name: str = ""
    gpu_memory_total_mb: int = 0
    gpu_memory_used_mb: int = 0


class AndroidVersion(BaseModel):
    version: str
    api_level: int
    codename: str
    images_dir: str
    available: bool


class OSType(BaseModel):
    id: str
    name: str
    description: str
    available: bool
    icon: str = "smartphone"


# --- Auth Models ---

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=6)


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: str
    last_login: Optional[str] = None


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


class AssignDeviceRequest(BaseModel):
    user_id: int
    device_id: str
