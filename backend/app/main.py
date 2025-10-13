from fastapi import FastAPI, WebSocket, HTTPException, Request
from fastapi.responses import Response
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


@app.post("/instances", response_model=InstanceResponse)
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


@app.get("/instances")
async def list_instances():
    """List all active Android instances."""
    return docker_manager.list_instances()


@app.get("/instances/{instance_id}", response_model=InstanceResponse)
async def get_instance(instance_id: str):
    """Get information about a specific instance."""
    instance = docker_manager.get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    return instance


@app.delete("/instances/{instance_id}")
async def delete_instance(instance_id: str):
    """Delete an Android instance."""
    success = await docker_manager.delete_instance(instance_id)
    if not success:
        raise HTTPException(status_code=404, detail="Instance not found")
    return {"message": "Instance deleted successfully"}


@app.post("/instances/{instance_id}/input")
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


@app.post("/instances/{instance_id}/camera")
async def stream_camera(instance_id: str, request: Request):
    """Receive camera stream from browser and forward to Android."""
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


@app.websocket("/instances/{instance_id}/webrtc")
async def webrtc_endpoint(websocket: WebSocket, instance_id: str):
    """WebRTC signaling endpoint for screen streaming."""
    instance = docker_manager.get_instance(instance_id)
    if not instance:
        await websocket.close(code=1008, reason="Instance not found")
        return
    
    await webrtc_signaling.handle_websocket(websocket, instance_id)


@app.post("/instances/{instance_id}/call")
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


@app.post("/instances/{instance_id}/sms")
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
