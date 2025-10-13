import asyncio
import logging
import subprocess
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class CameraManager:
    
    def __init__(self):
        self.camera_processes: Dict[str, subprocess.Popen] = {}
        self.virtual_devices: Dict[str, str] = {}
    
    async def setup_virtual_camera(self, instance_id: str) -> str:
        try:
            result = subprocess.run(
                ["lsmod"], 
                capture_output=True, 
                text=True
            )
            if "v4l2loopback" not in result.stdout:
                raise Exception("v4l2loopback module not loaded")
            
            device_path = "/dev/video10"
            self.virtual_devices[instance_id] = device_path
            
            logger.info(f"Virtual camera device {device_path} assigned to instance {instance_id}")
            return device_path
            
        except Exception as e:
            logger.error(f"Failed to setup virtual camera: {e}")
            raise
    
    async def start_camera_stream(self, instance_id: str, video_data: bytes):
        if instance_id not in self.virtual_devices:
            raise ValueError(f"Virtual camera not set up for instance {instance_id}")
        
        device_path = self.virtual_devices[instance_id]
        
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
