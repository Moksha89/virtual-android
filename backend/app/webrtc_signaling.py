from fastapi import WebSocket
import json
import asyncio
import logging
from typing import Dict
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack, RTCIceCandidate
from av import VideoFrame
import subprocess
import numpy as np
import cv2

logger = logging.getLogger(__name__)


class AndroidScreenTrack(VideoStreamTrack):
    
    def __init__(self, instance_id: str, adb_port: str):
        super().__init__()
        logger.info(f"[DEBUG] AndroidScreenTrack.__init__ called for instance {instance_id}, port {adb_port}")
        self.instance_id = instance_id
        self.adb_port = adb_port
        self.frame_count = 0
        self.last_frame = None
        self.adb_connected = False
        logger.info(f"[DEBUG] AndroidScreenTrack initialized successfully for instance {instance_id}")
        
    async def ensure_adb_connected(self):
        """Ensure ADB is connected to the device."""
        if self.adb_connected:
            logger.info(f"[DEBUG] ensure_adb_connected: Already connected for instance {self.instance_id}")
            return
        
        logger.info(f"[DEBUG] ensure_adb_connected: Starting ADB connection for instance {self.instance_id}")
        try:
            cmd = ["adb", "connect", f"localhost:{self.adb_port}"]
            logger.info(f"[DEBUG] ensure_adb_connected: About to execute: {' '.join(cmd)}")
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            logger.info(f"[DEBUG] ensure_adb_connected: Process created, waiting for output with 5s timeout")
            
            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=5.0)
                logger.info(f"[DEBUG] ensure_adb_connected: Process completed, returncode={process.returncode}, stdout={stdout.decode()}, stderr={stderr.decode()}")
            except asyncio.TimeoutError:
                logger.error(f"[DEBUG] ensure_adb_connected: TIMEOUT after 5s, killing process")
                process.kill()
                await process.wait()
                raise Exception("ADB connect timeout after 5 seconds")
            
            if process.returncode == 0:
                logger.info(f"ADB connected to localhost:{self.adb_port} for instance {self.instance_id}")
                self.adb_connected = True
                logger.info(f"[DEBUG] ensure_adb_connected: About to sleep 1s")
                await asyncio.sleep(1)
                logger.info(f"[DEBUG] ensure_adb_connected: Sleep completed, connection ready")
            else:
                logger.error(f"Failed to connect ADB to localhost:{self.adb_port}: {stderr.decode()}")
        except Exception as e:
            logger.error(f"Error connecting to ADB: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
    
    async def recv(self):
        logger.info(f"[DEBUG] AndroidScreenTrack.recv() called for instance {self.instance_id}")
        try:
            logger.info(f"[DEBUG] recv: About to call ensure_adb_connected() for instance {self.instance_id}")
            await self.ensure_adb_connected()
            logger.info(f"[DEBUG] recv: ensure_adb_connected() completed for instance {self.instance_id}")
            
            logger.info(f"[DEBUG] recv: About to call next_timestamp() for instance {self.instance_id}")
            pts, time_base = await self.next_timestamp()
            logger.info(f"[DEBUG] recv: next_timestamp() returned pts={pts}, time_base={time_base} for instance {self.instance_id}")
            
            logger.info(f"[DEBUG] recv: About to execute screencap command for instance {self.instance_id}")
            cmd = [
                "adb", "-s", f"localhost:{self.adb_port}",
                "exec-out", "screencap", "-p"
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            logger.info(f"[DEBUG] recv: subprocess created, waiting for output for instance {self.instance_id}")
            
            stdout, stderr = await process.communicate()
            logger.info(f"[DEBUG] recv: subprocess completed, returncode={process.returncode}, stdout_len={len(stdout) if stdout else 0}, stderr_len={len(stderr) if stderr else 0} for instance {self.instance_id}")
            
            if process.returncode == 0 and stdout:
                logger.info(f"[DEBUG] recv: About to decode PNG data for instance {self.instance_id}")
                nparr = np.frombuffer(stdout, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                logger.info(f"[DEBUG] recv: PNG decoded, img shape: {img.shape if img is not None else 'None'} for instance {self.instance_id}")
                
                if img is not None:
                    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                    logger.info(f"[DEBUG] recv: Converted to RGB, shape: {img_rgb.shape} for instance {self.instance_id}")
                    
                    height, width = img_rgb.shape[:2]
                    target_height = 720
                    target_width = int(width * (target_height / height))
                    img_resized = cv2.resize(img_rgb, (target_width, target_height))
                    logger.info(f"[DEBUG] recv: Resized to {target_width}x{target_height} for instance {self.instance_id}")
                    
                    frame = VideoFrame.from_ndarray(img_resized, format="rgb24")
                    frame.pts = pts
                    frame.time_base = time_base
                    logger.info(f"[DEBUG] recv: Created VideoFrame with pts={pts}, time_base={time_base} for instance {self.instance_id}")
                    
                    self.last_frame = frame
                    self.frame_count += 1
                    
                    if self.frame_count % 30 == 0:
                        logger.info(f"Captured {self.frame_count} frames for instance {self.instance_id}")
                    
                    logger.info(f"[DEBUG] recv: About to return frame #{self.frame_count} for instance {self.instance_id}")
                    return frame
            
            if stderr:
                logger.error(f"Screencap stderr for instance {self.instance_id}: {stderr.decode()}")
            
            if self.last_frame:
                logger.warning(f"Failed to capture frame for instance {self.instance_id}, returning last frame")
                return self.last_frame
            
            logger.error(f"Failed to capture screen for instance {self.instance_id}: returncode={process.returncode}")
            
            fallback_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
            fallback_frame[:, :, 2] = 128
            frame = VideoFrame.from_ndarray(fallback_frame, format="rgb24")
            frame.pts = pts
            frame.time_base = time_base
            return frame
            
        except Exception as e:
            logger.error(f"Error capturing Android screen: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            if self.last_frame:
                return self.last_frame
            
            fallback_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
            fallback_frame[:, :, 0] = 128
            frame = VideoFrame.from_ndarray(fallback_frame, format="rgb24")
            frame.pts = pts
            frame.time_base = time_base
            return frame
    
    async def close(self):
        pass


class WebRTCSignaling:
    
    def __init__(self):
        self.connections: Dict[str, Dict[str, WebSocket]] = {}
        self.peer_connections: Dict[str, Dict[str, RTCPeerConnection]] = {}
    
    async def handle_websocket(self, websocket: WebSocket, instance_id: str):
        await websocket.accept()
        
        import uuid
        connection_id = str(uuid.uuid4())
        
        if instance_id not in self.connections:
            self.connections[instance_id] = {}
            self.peer_connections[instance_id] = {}
        
        self.connections[instance_id][connection_id] = websocket
        
        logger.info(f"WebRTC signaling connection established for instance {instance_id}, connection {connection_id}")
        
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                message_type = message.get("type")
                
                if message_type == "offer":
                    await self.handle_offer(instance_id, connection_id, message, websocket)
                    
                elif message_type == "ice-candidate":
                    await self.handle_ice_candidate(instance_id, connection_id, message)
                    
                elif message_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    
                elif message_type == "gamepad":
                    await self.handle_gamepad(instance_id, message)
                
        except Exception as e:
            logger.error(f"WebSocket error for instance {instance_id}, connection {connection_id}: {e}")
        finally:
            if instance_id in self.connections and connection_id in self.connections[instance_id]:
                del self.connections[instance_id][connection_id]
            if instance_id in self.peer_connections and connection_id in self.peer_connections[instance_id]:
                await self.peer_connections[instance_id][connection_id].close()
                del self.peer_connections[instance_id][connection_id]
            
            if instance_id in self.connections and not self.connections[instance_id]:
                del self.connections[instance_id]
            if instance_id in self.peer_connections and not self.peer_connections[instance_id]:
                del self.peer_connections[instance_id]
                
            logger.info(f"WebRTC signaling connection closed for instance {instance_id}, connection {connection_id}")
    
    async def handle_offer(self, instance_id: str, connection_id: str, message: dict, websocket: WebSocket):
        logger.info(f"Received WebRTC offer for instance {instance_id}, connection {connection_id}")
        logger.info(f"Message type: {message.get('type')}, SDP length: {len(message.get('sdp', '')) if message.get('sdp') else 'None'}")
        
        try:
            pc = RTCPeerConnection()
            self.peer_connections[instance_id][connection_id] = pc
            
            from app.main import docker_manager
            instance = docker_manager.get_instance(instance_id)
            if not instance:
                raise ValueError(f"Instance {instance_id} not found")
            
            screen_track = AndroidScreenTrack(instance_id, instance["adb_port"])
            logger.info(f"[DEBUG] Created AndroidScreenTrack for instance {instance_id}, connection {connection_id}")
            pc.addTrack(screen_track)
            logger.info(f"[DEBUG] Added AndroidScreenTrack to peer connection for instance {instance_id}, connection {connection_id}")
            
            @pc.on("datachannel")
            async def on_datachannel(channel):
                logger.info(f"Data channel opened: {channel.label}")
                
                @channel.on("message")
                async def on_message(message):
                    if isinstance(message, str):
                        try:
                            data = json.loads(message)
                            if data.get("type") == "clipboard":
                                clipboard_text = data.get("content", "")
                                adb_port = instance["adb_port"]
                                
                                escaped_text = clipboard_text.replace('"', '\\"').replace('$', '\\$').replace('`', '\\`')
                                
                                process = await asyncio.create_subprocess_exec(
                                    "adb", "-s", f"localhost:{adb_port}",
                                    "shell", f'input text "{escaped_text}"',
                                    stdout=asyncio.subprocess.PIPE,
                                    stderr=asyncio.subprocess.PIPE
                                )
                                await process.communicate()
                                
                                logger.info(f"Set Android clipboard for {instance_id}")
                        except Exception as e:
                            logger.error(f"Failed to handle clipboard: {e}")
            
            @pc.on("iceconnectionstatechange")
            async def on_ice_connection_state_change():
                logger.info(f"ICE connection state for {connection_id}: {pc.iceConnectionState}")
            
            offer = RTCSessionDescription(
                sdp=message["sdp"],
                type=message["type"]
            )
            await pc.setRemoteDescription(offer)
            
            answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            
            await websocket.send_json({
                "type": "answer",
                "sdp": pc.localDescription.sdp
            })
            
            logger.info(f"WebRTC answer sent for instance {instance_id}, connection {connection_id}")
            
        except Exception as e:
            import traceback
            logger.error(f"Error handling WebRTC offer: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            logger.error(f"Full message received: {message}")
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
    
    async def handle_gamepad(self, instance_id: str, data: dict):
        from app.main import docker_manager
        
        button = data.get("button")
        pressed = data.get("pressed", False)
        
        button_mapping = {
            0: 96,   # A button -> BUTTON_A (important-comment)
            1: 97,   # B button -> BUTTON_B (important-comment)
            2: 99,   # X button -> BUTTON_X (important-comment)
            3: 100,  # Y button -> BUTTON_Y (important-comment)
            4: 102,  # L1 -> BUTTON_L1 (important-comment)
            5: 103,  # R1 -> BUTTON_R1 (important-comment)
            6: 104,  # L2 -> BUTTON_L2 (important-comment)
            7: 105,  # R2 -> BUTTON_R2 (important-comment)
            8: 109,  # Select -> BUTTON_SELECT (important-comment)
            9: 108,  # Start -> BUTTON_START (important-comment)
            10: 106, # L3 -> BUTTON_THUMBL (important-comment)
            11: 107, # R3 -> BUTTON_THUMBR (important-comment)
            12: 19,  # D-pad up -> DPAD_UP (important-comment)
            13: 20,  # D-pad down -> DPAD_DOWN (important-comment)
            14: 21,  # D-pad left -> DPAD_LEFT (important-comment)
            15: 22,  # D-pad right -> DPAD_RIGHT (important-comment)
        }
        
        if button in button_mapping:
            keycode = button_mapping[button]
            
            try:
                instance = docker_manager.get_instance(instance_id)
                if instance:
                    container = await asyncio.to_thread(
                        docker_manager.client.containers.get,
                        instance["container_id"]
                    )
                    
                    await asyncio.to_thread(
                        container.exec_run,
                        cmd=f"sh -c 'input keyevent {keycode}'"
                    )
                    
                    logger.debug(f"Gamepad button {button} sent to instance {instance_id}")
            except Exception as e:
                logger.error(f"Failed to send gamepad event: {e}")
    
    async def handle_ice_candidate(self, instance_id: str, connection_id: str, message: dict):
        logger.info(f"Received ICE candidate for instance {instance_id}, connection {connection_id}")
        
        if instance_id in self.peer_connections and connection_id in self.peer_connections[instance_id]:
            pc = self.peer_connections[instance_id][connection_id]
            candidate_dict = message.get("candidate")
            if candidate_dict and isinstance(candidate_dict, dict):
                try:
                    candidate_sdp = candidate_dict.get("candidate", "")
                    if candidate_sdp:
                        parts = candidate_sdp.split()
                        if len(parts) >= 8:
                            candidate = RTCIceCandidate(
                                component=int(parts[1]),
                                foundation=parts[0].split(":")[1],
                                ip=parts[4],
                                port=int(parts[5]),
                                priority=int(parts[3]),
                                protocol=parts[2],
                                type=parts[7],
                                sdpMid=candidate_dict.get("sdpMid"),
                                sdpMLineIndex=candidate_dict.get("sdpMLineIndex")
                            )
                            await pc.addIceCandidate(candidate)
                            logger.info(f"Added ICE candidate for instance {instance_id}, connection {connection_id}")
                except Exception as e:
                    logger.error(f"Failed to add ICE candidate: {e}")
