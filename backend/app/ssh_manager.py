"""SSH manager for communicating with the Cuttlefish server."""

import asyncio
import asyncssh
import os
from dotenv import load_dotenv

load_dotenv()

SSH_HOST = os.getenv("SSH_HOST", "173.208.243.135")
PUBLIC_IP = os.getenv("PUBLIC_IP", SSH_HOST)
SSH_PORT = int(os.getenv("SSH_PORT", "22"))
SSH_USERNAME = os.getenv("SSH_USERNAME", "administrator")
SSH_PASSWORD = os.getenv("SSH_PASSWORD", "")
CF_IMAGES_DIR = os.getenv("CF_IMAGES_DIR", "/home/administrator/cf-images-a14")
CF_HOME_DIR = os.getenv("CF_HOME_DIR", "/home/administrator")


async def run_ssh_command(command: str, timeout: float = 30.0) -> tuple[str, str, int]:
    """Run a command on the remote server via SSH. Returns (stdout, stderr, returncode)."""
    try:
        async with asyncssh.connect(
            SSH_HOST,
            port=SSH_PORT,
            username=SSH_USERNAME,
            password=SSH_PASSWORD,
            known_hosts=None,
            connect_timeout=10,
        ) as conn:
            result = await asyncio.wait_for(
                conn.run(command, check=False),
                timeout=timeout,
            )
            return (
                result.stdout or "",
                result.stderr or "",
                result.returncode if result.returncode is not None else -1,
            )
    except asyncio.TimeoutError:
        return "", "Command timed out", -1
    except Exception as e:
        return "", str(e), -1


async def get_server_status() -> dict:
    """Get server resource usage."""
    cmd = """
echo '===CPU_CORES===' && nproc &&
echo '===CPU_USAGE===' && top -bn1 | grep 'Cpu(s)' | awk '{print $2}' &&
echo '===MEMORY===' && free -b | grep Mem &&
echo '===DISK===' && df -B1 / | tail -1 &&
echo '===GPU===' && nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv,noheader,nounits 2>/dev/null || echo 'no-gpu'
"""
    stdout, _, _ = await run_ssh_command(cmd)
    result = {
        "cpu_cores": 0,
        "cpu_usage_percent": 0.0,
        "ram_total_gb": 0.0,
        "ram_used_gb": 0.0,
        "ram_available_gb": 0.0,
        "disk_total_gb": 0.0,
        "disk_used_gb": 0.0,
        "disk_available_gb": 0.0,
        "gpu_name": "",
        "gpu_memory_total_mb": 0,
        "gpu_memory_used_mb": 0,
    }

    lines = stdout.strip().split("\n")
    section = ""
    for line in lines:
        line = line.strip()
        if line.startswith("==="):
            section = line.strip("=")
            continue
        if section == "CPU_CORES" and line.isdigit():
            result["cpu_cores"] = int(line)
        elif section == "CPU_USAGE":
            try:
                result["cpu_usage_percent"] = float(line)
            except ValueError:
                pass
        elif section == "MEMORY" and line.startswith("Mem:"):
            parts = line.split()
            if len(parts) >= 7:
                result["ram_total_gb"] = round(int(parts[1]) / (1024**3), 1)
                result["ram_used_gb"] = round(int(parts[2]) / (1024**3), 1)
                result["ram_available_gb"] = round(int(parts[6]) / (1024**3), 1)
        elif section == "DISK" and not line.startswith("Filesystem"):
            parts = line.split()
            if len(parts) >= 4:
                result["disk_total_gb"] = round(int(parts[1]) / (1024**3), 1)
                result["disk_used_gb"] = round(int(parts[2]) / (1024**3), 1)
                result["disk_available_gb"] = round(int(parts[3]) / (1024**3), 1)
        elif section == "GPU" and line != "no-gpu":
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 3:
                result["gpu_name"] = parts[0]
                try:
                    result["gpu_memory_total_mb"] = int(parts[1])
                    result["gpu_memory_used_mb"] = int(parts[2])
                except ValueError:
                    pass

    return result


async def get_running_devices() -> list[dict]:
    """Get list of running Cuttlefish instances."""
    cmd = """
adb devices 2>/dev/null | grep -v 'List of devices' | grep -v '^$' | while read line; do
  serial=$(echo "$line" | awk '{print $1}')
  state=$(echo "$line" | awk '{print $2}')
  if [ "$state" = "device" ] && echo "$serial" | grep -q ':'; then
    port=$(echo "$serial" | cut -d: -f2)
    echo "DEVICE:$serial:$port:$state"
  fi
done
"""
    stdout, _, _ = await run_ssh_command(cmd)
    devices = []
    for line in stdout.strip().split("\n"):
        if line.startswith("DEVICE:"):
            parts = line.split(":")
            if len(parts) >= 4:
                devices.append({
                    "serial": parts[1] + ":" + parts[2],
                    "port": int(parts[2]),
                    "state": parts[3],
                })
    return devices


async def get_device_properties(serial: str) -> dict:
    """Get Android device properties via ADB."""
    cmd = f"""
adb -s {serial} shell getprop ro.build.version.release 2>/dev/null &&
echo '---SEP---' &&
adb -s {serial} shell getprop ro.build.version.sdk 2>/dev/null &&
echo '---SEP---' &&
adb -s {serial} shell getprop ro.product.model 2>/dev/null &&
echo '---SEP---' &&
adb -s {serial} shell getprop ro.serialno 2>/dev/null &&
echo '---SEP---' &&
adb -s {serial} shell getprop sys.boot_completed 2>/dev/null
"""
    stdout, _, _ = await run_ssh_command(cmd)
    parts = stdout.split("---SEP---")
    return {
        "android_version": parts[0].strip() if len(parts) > 0 else "",
        "sdk": parts[1].strip() if len(parts) > 1 else "",
        "model": parts[2].strip() if len(parts) > 2 else "",
        "serial_no": parts[3].strip() if len(parts) > 3 else "",
        "boot_completed": parts[4].strip() == "1" if len(parts) > 4 else False,
    }


async def get_cuttlefish_instances() -> list[dict]:
    """Get Cuttlefish instance info from the instance directories."""
    cmd = f"""
ls -d {CF_HOME_DIR}/cuttlefish/instances/cvd-* 2>/dev/null | while read dir; do
  id=$(basename "$dir" | sed 's/cvd-//')
  running="false"
  if ps aux | grep -v grep | grep "cuttlefish/instances/cvd-$id" > /dev/null 2>&1; then
    running="true"
  fi
  echo "INSTANCE:$id:$running:$dir"
done
"""
    stdout, _, _ = await run_ssh_command(cmd)
    instances = []
    for line in stdout.strip().split("\n"):
        if line.startswith("INSTANCE:"):
            parts = line.split(":")
            if len(parts) >= 4:
                instances.append({
                    "instance_id": int(parts[1]),
                    "running": parts[2] == "true",
                    "dir": parts[3],
                })
    return instances


async def _stop_all_instances() -> tuple[bool, str]:
    """Stop all running Cuttlefish instances using stop_cvd."""
    cmd = f"""
export HOME={CF_HOME_DIR}
export ANDROID_HOST_OUT={CF_IMAGES_DIR}
# Try graceful stop first
{CF_IMAGES_DIR}/bin/stop_cvd 2>&1 || true
sleep 2
# Kill any remaining processes
for pid in $(ps aux | grep -E 'run_cvd|crosvm|log_tee|adb_connector|webrtc|echo_server|gnss_grpc|openwrt|tombstone|modem_sim|process_restarter|proxy_adb|config_server|metrics|socket_vsock' | grep -v grep | grep -v sshd | grep -v 'bash -c' | awk '{{print $2}}'); do
  kill -9 $pid 2>/dev/null
done
sleep 1
echo "STOP_ALL:done"
"""
    stdout, stderr, _ = await run_ssh_command(cmd, timeout=30.0)
    output = stdout + stderr
    if "STOP_ALL:done" in output:
        return True, "All instances stopped"
    return False, f"Failed to stop instances: {output}"


async def _launch_instances(
    num_instances: int,
    ram_mb: int = 4096,
    cpus: int = 4,
    storage_gb: int = 64,
    x_res: int = 1080,
    y_res: int = 2340,
    dpi: int = 420,
    gpu_mode: str = "guest_swiftshader",
) -> tuple[bool, str]:
    """Launch N Cuttlefish instances using a single launch_cvd call."""
    storage_mb = storage_gb * 1024
    cmd = f"""
export HOME={CF_HOME_DIR}
export ANDROID_HOST_OUT={CF_IMAGES_DIR}
# Clean up old instance/assembly dirs
rm -rf {CF_HOME_DIR}/cuttlefish 2>/dev/null || true
rm -rf {CF_HOME_DIR}/cuttlefish_assembly 2>/dev/null || true
rm -rf {CF_HOME_DIR}/cuttlefish_runtime 2>/dev/null || true
rm -rf /tmp/cf_avd_1000 2>/dev/null || true
nohup {CF_IMAGES_DIR}/bin/launch_cvd \\
  --report_anonymous_usage_stats=n \\
  --daemon \\
  --num_instances={num_instances} \\
  --base_instance_num=1 \\
  --system_image_dir={CF_IMAGES_DIR} \\
  --noresume \\
  --memory_mb={ram_mb} \\
  --cpus={cpus} \\
  --x_res={x_res} \\
  --y_res={y_res} \\
  --dpi={dpi} \\
  --blank_data_image_mb={storage_mb} \\
  --gpu_mode={gpu_mode} \\
  > /tmp/launch_cvd_all.log 2>&1 &
echo "LAUNCH_PID=$!"
# Poll for up to 60 seconds for instances to start
for i in $(seq 1 30); do
  sleep 2
  if ps aux | grep -v grep | grep "crosvm.*cvd-{num_instances}" > /dev/null 2>&1; then
    echo "LAUNCH_STATUS:starting"
    exit 0
  fi
  # Check if launch_cvd already exited
  if [ $i -gt 5 ]; then
    if ! ps aux | grep -v grep | grep "launch_cvd" > /dev/null 2>&1; then
      if grep -q 'VIRTUAL_DEVICE_BOOT_COMPLETED' /tmp/launch_cvd_all.log 2>/dev/null; then
        echo "LAUNCH_STATUS:starting"
        exit 0
      fi
      if grep -q 'VIRTUAL_DEVICE_BOOT_FAILED' /tmp/launch_cvd_all.log 2>/dev/null; then
        echo "LAUNCH_STATUS:failed"
        tail -20 /tmp/launch_cvd_all.log 2>/dev/null
        exit 1
      fi
    fi
  fi
done
# Final check
if ps aux | grep -v grep | grep "crosvm.*cvd-1" > /dev/null 2>&1; then
  echo "LAUNCH_STATUS:starting"
else
  echo "LAUNCH_STATUS:failed"
  tail -20 /tmp/launch_cvd_all.log 2>/dev/null
fi
"""
    stdout, stderr, rc = await run_ssh_command(cmd, timeout=120.0)
    output = stdout + stderr
    if "LAUNCH_STATUS:starting" in output:
        return True, "Instances are starting..."
    else:
        return False, f"Failed to launch instances: {output}"


async def launch_device(
    instance_id: int,
    ram_mb: int,
    storage_gb: int,
    cpus: int,
    x_res: int,
    y_res: int,
    dpi: int,
    gpu_mode: str = "guest_swiftshader",
) -> tuple[bool, str]:
    """Launch a new Cuttlefish device by relaunching all instances.

    Cuttlefish requires all instances to be managed by a single launch_cvd call.
    This stops all running instances and relaunches with num_instances incremented.
    """
    instances = await get_cuttlefish_instances()
    total_instances = max(instance_id, len(instances) + 1)

    # Stop all existing instances
    await _stop_all_instances()

    # Relaunch with the new total count
    success, message = await _launch_instances(
        num_instances=total_instances,
        ram_mb=ram_mb,
        cpus=cpus,
        storage_gb=storage_gb,
        x_res=x_res,
        y_res=y_res,
        dpi=dpi,
        gpu_mode=gpu_mode,
    )
    if success:
        return True, "Device is starting..."
    return False, message


async def stop_device(instance_id: int) -> tuple[bool, str]:
    """Stop a Cuttlefish device by relaunching remaining instances.

    Since Cuttlefish manages all instances together, stopping one means
    stopping all and relaunching with num_instances - 1.
    """
    instances = await get_cuttlefish_instances()
    remaining = len(instances) - 1

    # Stop all instances
    await _stop_all_instances()

    if remaining <= 0:
        # No more instances needed, clean up
        cmd = f"""
rm -rf {CF_HOME_DIR}/cuttlefish 2>/dev/null || true
rm -rf {CF_HOME_DIR}/cuttlefish_assembly 2>/dev/null || true
rm -rf {CF_HOME_DIR}/cuttlefish_runtime 2>/dev/null || true
rm -rf /tmp/cf_avd_1000 2>/dev/null || true
echo "CLEANUP:done"
"""
        await run_ssh_command(cmd, timeout=15.0)
        return True, "Device stopped successfully"

    # Relaunch remaining instances with default config
    success, message = await _launch_instances(num_instances=remaining)
    if success:
        return True, "Device stopped successfully"
    return False, f"Device stopped but failed to relaunch remaining: {message}"


async def get_next_instance_id() -> int:
    """Get the next available instance ID."""
    instances = await get_cuttlefish_instances()
    if not instances:
        return 1
    max_id = max(i["instance_id"] for i in instances)
    return max_id + 1
