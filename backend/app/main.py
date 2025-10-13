from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import logging

from app.docker_manager import DockerManager
from app.webrtc_signaling import WebRTCSignaling

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Virtual Android API")

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


@app.post("/api/instances", response_model=InstanceResponse)
async def create_instance(request: CreateInstanceRequest):
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
async def send_input_event(instance_id: str, request: InputEventRequest):
    """Send touch input event to an Android instance."""
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


@app.websocket("/api/instances/{instance_id}/webrtc")
async def webrtc_endpoint(websocket: WebSocket, instance_id: str):
    """WebRTC signaling endpoint for screen streaming."""
    instance = docker_manager.get_instance(instance_id)
    if not instance:
        await websocket.close(code=1008, reason="Instance not found")
        return
    
    await webrtc_signaling.handle_websocket(websocket, instance_id)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {
        "message": "Virtual Android API",
        "status": "running",
        "version": "1.0.0"
    }
