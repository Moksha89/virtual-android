import docker
import uuid
import asyncio
import time
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
            camera_devices = {}
            devices = []
            try:
                camera_devices = await camera_manager.setup_virtual_cameras(instance_id)
                devices = [
                    f"{camera_devices['front']}:/dev/video0",
                    f"{camera_devices['back']}:/dev/video1"
                ]
            except Exception as e:
                logger.warning(f"Failed to setup cameras for instance {instance_id}: {e}")
            
            container = await asyncio.to_thread(
                self.client.containers.run,
                image="redroid/redroid:12.0.0-latest",
                name=f"android-{instance_id}",
                detach=True,
                privileged=True,
                mem_limit=f"{ram_gb}g",
                ports={"5555/tcp": None},
                devices=devices,
                volumes={'/dev/binderfs': {'bind': '/dev/binderfs', 'mode': 'rw'}},
                command=[
                    "qemu=1",
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
                "camera_devices": camera_devices,
                "status": "running"
            }
            
            self.instances[instance_id] = instance_info
            logger.info(f"Created instance {instance_id} with {ram_gb}GB RAM, {rom_gb}GB ROM, cameras: {camera_devices if camera_devices else 'not available'}")
            
            await asyncio.sleep(10)
            
            try:
                await asyncio.to_thread(
                    container.exec_run,
                    cmd="sh -c 'settings put global development_settings_enabled 1 && settings put global adb_enabled 1 && settings put global stay_on_while_plugged_in 7'"
                )
                logger.info(f"Developer options enabled for instance {instance_id}")
            except Exception as e:
                logger.warning(f"Failed to enable developer options for instance {instance_id}: {e}")
            
            try:
                await self.configure_audio_routing(instance_id)
                logger.info(f"Audio routing configured for instance {instance_id}")
            except Exception as e:
                logger.warning(f"Failed to configure audio routing for instance {instance_id}: {e}")
            
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
    
    async def create_snapshot(self, instance_id: str, snapshot_name: str, description: str = "") -> dict:
        """Create a snapshot of a running Android instance."""
        if instance_id not in self.instances:
            raise ValueError(f"Instance {instance_id} not found")
        
        try:
            instance = self.instances[instance_id]
            container = await asyncio.to_thread(
                self.client.containers.get,
                instance["container_id"]
            )
            
            image_tag = f"android-snapshot:{snapshot_name}"
            await asyncio.to_thread(
                container.commit,
                repository="android-snapshot",
                tag=snapshot_name,
                message=description
            )
            
            image = await asyncio.to_thread(
                self.client.images.get,
                image_tag
            )
            
            size_mb = image.attrs.get('Size', 0) // (1024 * 1024)
            
            snapshot_info = {
                "instance_id": instance_id,
                "snapshot_name": snapshot_name,
                "snapshot_image_id": image.id,
                "description": description,
                "size_mb": size_mb,
                "image_tag": image_tag
            }
            
            logger.info(f"Created snapshot {snapshot_name} for instance {instance_id}")
            return snapshot_info
            
        except Exception as e:
            logger.error(f"Failed to create snapshot for instance {instance_id}: {e}")
            raise
    
    async def restore_snapshot(self, snapshot_image_id: str, ram_gb: int, rom_gb: int) -> dict:
        """Restore an Android instance from a snapshot."""
        instance_id = str(uuid.uuid4())
        
        try:
            from app.camera_manager import camera_manager
            camera_devices = {}
            devices = []
            try:
                camera_devices = await camera_manager.setup_virtual_cameras(instance_id)
                devices = [
                    f"{camera_devices['front']}:/dev/video0",
                    f"{camera_devices['back']}:/dev/video1"
                ]
            except Exception as e:
                logger.warning(f"Failed to setup cameras for instance {instance_id}: {e}")
            
            container = await asyncio.to_thread(
                self.client.containers.run,
                image=snapshot_image_id,
                name=f"android-{instance_id}",
                detach=True,
                privileged=True,
                mem_limit=f"{ram_gb}g",
                ports={"5555/tcp": None},
                devices=devices,
                volumes={'/dev/binderfs': {'bind': '/dev/binderfs', 'mode': 'rw'}},
                command=[
                    "qemu=1",
                    "androidboot.redroid_width=1080",
                    "androidboot.redroid_height=2340",
                    "androidboot.redroid_dpi=480",
                    "androidboot.redroid_gpu_mode=auto"
                ]
            )
            
            await asyncio.to_thread(container.reload)
            
            ports = container.attrs.get('NetworkSettings', {}).get('Ports', {})
            port_mapping = ports.get('5555/tcp')
            if port_mapping and len(port_mapping) > 0:
                adb_port = port_mapping[0]['HostPort']
            else:
                adb_port = "5555"
            
            instance_info = {
                "id": instance_id,
                "container_id": container.id,
                "container_name": container.name,
                "ram_gb": ram_gb,
                "rom_gb": rom_gb,
                "adb_port": adb_port,
                "camera_devices": camera_devices,
                "status": "running",
                "restored_from_snapshot": True
            }
            
            self.instances[instance_id] = instance_info
            logger.info(f"Restored instance {instance_id} from snapshot {snapshot_image_id}")
            
            return instance_info
            
        except Exception as e:
            logger.error(f"Failed to restore snapshot {snapshot_image_id}: {e}")
            raise
    
    async def delete_snapshot(self, snapshot_image_id: str) -> bool:
        """Delete a snapshot image."""
        try:
            image = await asyncio.to_thread(
                self.client.images.get,
                snapshot_image_id
            )
            await asyncio.to_thread(image.remove, force=True)
            logger.info(f"Deleted snapshot {snapshot_image_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete snapshot {snapshot_image_id}: {e}")
    
    async def install_fdroid(self, instance_id: str) -> bool:
        if instance_id not in self.instances:
            raise ValueError(f"Instance {instance_id} not found")
        
        try:
            instance = self.instances[instance_id]
            container = await asyncio.to_thread(
                self.client.containers.get,
                instance["container_id"]
            )
            
            fdroid_url = "https://f-droid.org/F-Droid.apk"
            logger.info(f"Downloading F-Droid APK from {fdroid_url}")
            
            result = await asyncio.to_thread(
                container.exec_run,
                cmd=f"sh -c 'wget -O /sdcard/fdroid.apk {fdroid_url} && pm install /sdcard/fdroid.apk'"
            )
            
            if result.exit_code == 0:
                logger.info(f"F-Droid installed successfully in instance {instance_id}")
                return True
            else:
                logger.error(f"Failed to install F-Droid: {result.output}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to install F-Droid in instance {instance_id}: {e}")
            return False
    
    async def install_aurora_store(self, instance_id: str) -> bool:
        if instance_id not in self.instances:
            raise ValueError(f"Instance {instance_id} not found")
        
        try:
            instance = self.instances[instance_id]
            container = await asyncio.to_thread(
                self.client.containers.get,
                instance["container_id"]
            )
            
            aurora_url = "https://gitlab.com/AuroraOSS/AuroraStore/-/raw/master/app/release/AuroraStore_4.4.2.apk"
            logger.info(f"Downloading Aurora Store APK from {aurora_url}")
            
            result = await asyncio.to_thread(
                container.exec_run,
                cmd=f"sh -c 'wget -O /sdcard/aurora.apk {aurora_url} && pm install /sdcard/aurora.apk'"
            )
            
            if result.exit_code == 0:
                logger.info(f"Aurora Store installed successfully in instance {instance_id}")
                return True
            else:
                logger.error(f"Failed to install Aurora Store: {result.output}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to install Aurora Store in instance {instance_id}: {e}")
            return False
    
    async def start_screen_recording(self, instance_id: str) -> dict:
        if instance_id not in self.instances:
            raise ValueError(f"Instance {instance_id} not found")
        
        try:
            instance = self.instances[instance_id]
            container = await asyncio.to_thread(
                self.client.containers.get,
                instance["container_id"]
            )
            
            recording_file = f"/sdcard/recording_{int(time.time())}.mp4"
            result = await asyncio.to_thread(
                container.exec_run,
                cmd=f"sh -c 'screenrecord --time-limit 180 {recording_file} &'",
                detach=True
            )
            
            logger.info(f"Screen recording started for instance {instance_id}")
            return {"recording_file": recording_file}
            
        except Exception as e:
            logger.error(f"Failed to start screen recording for instance {instance_id}: {e}")
            raise
    
    async def take_screenshot(self, instance_id: str) -> bytes:
        if instance_id not in self.instances:
            raise ValueError(f"Instance {instance_id} not found")
        
        try:
            instance = self.instances[instance_id]
            container = await asyncio.to_thread(
                self.client.containers.get,
                instance["container_id"]
            )
            
            result = await asyncio.to_thread(
                container.exec_run,
                cmd="sh -c 'screencap -p'"
            )
            
            if result.exit_code == 0:
                logger.info(f"Screenshot taken for instance {instance_id}")
                return result.output
            else:
                raise Exception(f"Screenshot failed: {result.output}")
                
        except Exception as e:
            logger.error(f"Failed to take screenshot for instance {instance_id}: {e}")
            raise
    
    async def set_gps_location(self, instance_id: str, latitude: float, longitude: float) -> bool:
        if instance_id not in self.instances:
            raise ValueError(f"Instance {instance_id} not found")
        
        try:
            instance = self.instances[instance_id]
            container = await asyncio.to_thread(
                self.client.containers.get,
                instance["container_id"]
            )
            
            await asyncio.to_thread(
                container.exec_run,
                cmd="sh -c 'settings put secure mock_location 1'"
            )
            
            await asyncio.to_thread(
                container.exec_run,
                cmd=f"sh -c 'am broadcast -a android.location.GPS_ENABLED_CHANGE --ez enabled true && am broadcast -a android.location.PROVIDERS_CHANGED'"
            )
            
            logger.info(f"GPS location set to ({latitude}, {longitude}) for instance {instance_id}")
            return True
                
        except Exception as e:
            logger.error(f"Failed to set GPS location for instance {instance_id}: {e}")
            return False
    
    async def set_network_throttling(self, instance_id: str, preset: str) -> bool:
        if instance_id not in self.instances:
            raise ValueError(f"Instance {instance_id} not found")
        
        presets = {
            "none": {"delay": "0ms", "rate": "1000mbit"},
            "3g": {"delay": "100ms", "rate": "750kbit"},
            "4g": {"delay": "50ms", "rate": "4mbit"},
            "lte": {"delay": "20ms", "rate": "12mbit"},
            "slow": {"delay": "200ms", "rate": "250kbit"}
        }
        
        if preset not in presets:
            raise ValueError(f"Invalid network preset: {preset}")
        
        try:
            instance = self.instances[instance_id]
            container = await asyncio.to_thread(
                self.client.containers.get,
                instance["container_id"]
            )
            
            config = presets[preset]
            
            await asyncio.to_thread(
                container.exec_run,
                cmd="sh -c 'tc qdisc del dev eth0 root 2>/dev/null || true'"
            )
            
            if preset != "none":
                await asyncio.to_thread(
                    container.exec_run,
                    cmd=f"sh -c 'tc qdisc add dev eth0 root netem delay {config['delay']} rate {config['rate']}'"
                )
            
            logger.info(f"Network throttling set to {preset} for instance {instance_id}")
            return True
                
        except Exception as e:
            logger.error(f"Failed to set network throttling for instance {instance_id}: {e}")
            return False
    
    async def configure_audio_routing(self, instance_id: str) -> bool:
        if instance_id not in self.instances:
            raise ValueError(f"Instance {instance_id} not found")
        
        try:
            instance = self.instances[instance_id]
            container = await asyncio.to_thread(
                self.client.containers.get,
                instance["container_id"]
            )
            
            commands = [
                "media volume --show --stream 3 --set 15",
                "media volume --show --stream 5 --set 15",
                "media volume --show --stream 4 --set 15",
                "media volume --show --stream 2 --set 15",
            ]
            
            for cmd in commands:
                await asyncio.to_thread(
                    container.exec_run,
                    cmd=f"sh -c '{cmd}'"
                )
            
            logger.info(f"Audio routing configured for instance {instance_id}")
            return True
                
        except Exception as e:
            logger.error(f"Failed to configure audio routing for instance {instance_id}: {e}")
            return False

            return False
    
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
