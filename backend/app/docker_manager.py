import docker
import uuid
import asyncio
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


class DockerManager:
    """Manages Docker containers for Android instances on remote server."""
    
    def __init__(self, docker_host: str):
        """Initialize Docker client with connection to Docker host."""
        try:
            use_ssh_client = docker_host.startswith('ssh://')
            self.client = docker.DockerClient(
                base_url=docker_host,
                use_ssh_client=use_ssh_client
            )
            self.instances: Dict[str, dict] = {}
            logger.info(f"Connected to Docker host: {docker_host}")
        except Exception as e:
            logger.error(f"Failed to connect to Docker: {e}")
            raise
    
    async def create_instance(self, ram_gb: int, rom_gb: int) -> dict:
        """Create a new Android instance with specified RAM and ROM."""
        instance_id = str(uuid.uuid4())
        
        try:
            from app.camera_manager import camera_manager
            camera_device = None
            devices = []
            try:
                camera_device = await camera_manager.setup_virtual_camera(instance_id)
                devices = [f"{camera_device}:/dev/video0"]
            except Exception as e:
                logger.warning(f"Failed to setup camera for instance {instance_id}: {e}")
            
            container = await asyncio.to_thread(
                self.client.containers.run,
                image="furtif/redroid:12.0.0-rooted-gapps",
                name=f"android-{instance_id}",
                detach=True,
                privileged=True,
                mem_limit=f"{ram_gb}g",
                ports={"5555/tcp": None},
                devices=devices,
                volumes={'/dev/binderfs': {'bind': '/dev/binderfs', 'mode': 'rw'}},
                command=[
                    "androidboot.redroid_width=1080",
                    "androidboot.redroid_height=2340",
                    "androidboot.redroid_dpi=480",
                    "androidboot.redroid_gpu_mode=auto"
                ]
            )
            
            await asyncio.to_thread(container.reload)
            
            ports = container.attrs.get('NetworkSettings', {}).get('Ports', {})
            logger.info(f"Container ports: {ports}")
            
            port_mapping = ports.get('5555/tcp')
            if port_mapping and len(port_mapping) > 0:
                adb_port = port_mapping[0]['HostPort']
            else:
                logger.warning(f"No port mapping found for 5555/tcp, using default")
                adb_port = "5555"
            
            instance_info = {
                "id": instance_id,
                "container_id": container.id,
                "container_name": container.name,
                "ram_gb": ram_gb,
                "rom_gb": rom_gb,
                "adb_port": adb_port,
                "camera_device": camera_device,
                "status": "running"
            }
            
            self.instances[instance_id] = instance_info
            logger.info(f"Created instance {instance_id} with {ram_gb}GB RAM, {rom_gb}GB ROM, camera: {camera_device if camera_device else 'not available'}")
            
            await asyncio.sleep(10)
            
            try:
                await asyncio.to_thread(
                    container.exec_run,
                    cmd="sh -c 'settings put global development_settings_enabled 1 && settings put global adb_enabled 1 && settings put global stay_on_while_plugged_in 7'"
                )
                logger.info(f"Developer options enabled for instance {instance_id}")
            except Exception as e:
                logger.warning(f"Failed to enable developer options for instance {instance_id}: {e}")
            
            return instance_info
            
        except Exception as e:
            logger.error(f"Failed to create instance: {e}")
            raise
    
    def get_instance(self, instance_id: str) -> Optional[dict]:
        """Get information about a specific instance."""
        return self.instances.get(instance_id)
    
    async def delete_instance(self, instance_id: str) -> bool:
        """Delete an Android instance and stop its container."""
        if instance_id not in self.instances:
            return False
        
        try:
            instance = self.instances[instance_id]
            container = await asyncio.to_thread(
                self.client.containers.get,
                instance["container_id"]
            )
            
            await asyncio.to_thread(container.stop, timeout=10)
            await asyncio.to_thread(container.remove)
            
            del self.instances[instance_id]
            logger.info(f"Deleted instance {instance_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete instance {instance_id}: {e}")
            return False
    
    def list_instances(self) -> list:
        """List all active instances."""
        return list(self.instances.values())
    
    async def send_input_event(self, instance_id: str, x: int, y: int, event_type: str = "tap"):
        """Send touch input event to Android instance via ADB."""
        if instance_id not in self.instances:
            raise ValueError(f"Instance {instance_id} not found")
        
        try:
            instance = self.instances[instance_id]
            container = await asyncio.to_thread(
                self.client.containers.get,
                instance["container_id"]
            )
            
            if event_type == "tap":
                cmd = f"input tap {int(x)} {int(y)}"
            elif event_type == "swipe":
                cmd = f"input swipe {int(x)} {int(y)} {int(x)} {int(y)} 100"
            else:
                cmd = f"input tap {int(x)} {int(y)}"
            
            result = await asyncio.to_thread(
                container.exec_run,
                cmd=f"sh -c '{cmd}'"
            )
            
            logger.debug(f"Sent input event to {instance_id}: {cmd}")
            
        except Exception as e:
            logger.error(f"Failed to send input event to {instance_id}: {e}")
            raise
