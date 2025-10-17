import asyncio
import logging
import subprocess
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class CameraManager:
    
    def __init__(self):
        self.camera_processes: Dict[str, subprocess.Popen] = {}
        self.virtual_devices: Dict[str, Dict[str, str]] = {}
        self.active_camera: Dict[str, str] = {}
    
    async def setup_virtual_cameras(self, instance_id: str) -> Dict[str, str]:
        try:
            result = subprocess.run(
                ["lsmod"], 
                capture_output=True, 
                text=True
            )
            if "v4l2loopback" not in result.stdout:
                raise Exception("v4l2loopback module not loaded")
            
            front_camera = "/dev/video10"
            back_camera = "/dev/video11"
            
            self.virtual_devices[instance_id] = {
                "front": front_camera,
                "back": back_camera
            }
            self.active_camera[instance_id] = "front"
            
            logger.info(f"Virtual cameras set up for instance {instance_id}: front={front_camera}, back={back_camera}")
            return self.virtual_devices[instance_id]
            
        except Exception as e:
            logger.error(f"Failed to setup virtual cameras: {e}")
            raise
    
    async def switch_camera(self, instance_id: str, camera_type: str):
        if instance_id not in self.virtual_devices:
            raise ValueError(f"Virtual cameras not set up for instance {instance_id}")
        
        if camera_type not in ["front", "back"]:
            raise ValueError(f"Invalid camera type: {camera_type}")
        
        self.active_camera[instance_id] = camera_type
        logger.info(f"Switched to {camera_type} camera for instance {instance_id}")
        return self.virtual_devices[instance_id][camera_type]
    
    async def start_camera_stream(self, instance_id: str, video_data: bytes):
        if instance_id not in self.virtual_devices:
            raise ValueError(f"Virtual cameras not set up for instance {instance_id}")
        
        active = self.active_camera.get(instance_id, "front")
        device_path = self.virtual_devices[instance_id][active]
        
        try:
            with open(device_path, 'wb') as device:
                device.write(video_data)
                
        except Exception as e:
            logger.error(f"Failed to write camera frame: {e}")
            raise
    
    async def stop_camera_stream(self, instance_id: str):
        if instance_id in self.camera_processes:
            process = self.camera_processes[instance_id]
            process.terminate()
            del self.camera_processes[instance_id]
        
        if instance_id in self.virtual_devices:
            del self.virtual_devices[instance_id]
        
        logger.info(f"Camera stream stopped for instance {instance_id}")


camera_manager = CameraManager()
