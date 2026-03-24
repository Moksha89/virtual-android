"""SSH manager for communicating with the Cuttlefish server."""

import asyncio
import asyncssh
import os
import base64
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


async def _setup_device_networking() -> None:
    """Set up bridge networking, NAT, WiFi, and DNS so Cuttlefish devices have
    full internet access on both mobile data and WiFi.

    Cuttlefish creates tap interfaces (cvd-mtap-XX) for mobile data but does not
    automatically set up bridges or NAT. The WiFi path goes through an OpenWrt VM
    whose WAN is isolated inside crosvm, so WiFi traffic must be redirected through
    the mobile bridge. This function:
    1. Creates the mobile bridge with gateway IPs and NAT masquerading
    2. Starts a dnsmasq DNS proxy on the bridge
    3. Enables WiFi and connects to VirtWifi
    4. Redirects the WiFi routing table through the mobile bridge
    5. DNATs all DNS queries to the working dnsmasq
    6. MASQUERADEs WiFi-sourced traffic so the host can route replies
    """
    cmd = """
# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward

# Wait for mobile tap interface to appear
for i in $(seq 1 30); do
    if ip link show cvd-mtap-01 &>/dev/null; then
        break
    fi
    sleep 1
done

if ! ip link show cvd-mtap-01 &>/dev/null; then
    echo "NETSETUP:no_tap"
    exit 0
fi

# Create mobile bridge if it doesn't exist
if ! ip link show cvd-mbr-01 &>/dev/null; then
    sudo ip link add name cvd-mbr-01 type bridge
fi
sudo ip link set cvd-mbr-01 up

# Add mobile tap to bridge
sudo ip link set cvd-mtap-01 master cvd-mbr-01 2>/dev/null || true

# Assign gateway IPs (10.0.2.2 is what Android RIL ARPs for)
sudo ip addr add 10.0.2.1/24 dev cvd-mbr-01 2>/dev/null || true
sudo ip addr add 10.0.2.2/24 dev cvd-mbr-01 2>/dev/null || true

# Enable proxy ARP on the bridge
echo 1 | sudo tee /proc/sys/net/ipv4/conf/cvd-mbr-01/proxy_arp > /dev/null

# Assign IP on ethernet tap for OpenWrt WAN (if exists)
if ip link show cvd-etap-01 &>/dev/null; then
    sudo ip addr add 192.168.96.1/24 dev cvd-etap-01 2>/dev/null || true
fi

# Detect primary outbound interface
PRIMARY_IF=$(ip route show default | awk '{print $5}' | head -1)

# NAT masquerade for device traffic (idempotent with -C check)
sudo iptables -t nat -C POSTROUTING -s 10.0.0.0/8 -o $PRIMARY_IF -j MASQUERADE 2>/dev/null || \
    sudo iptables -t nat -A POSTROUTING -s 10.0.0.0/8 -o $PRIMARY_IF -j MASQUERADE

# Forwarding rules (idempotent)
sudo iptables -C FORWARD -i cvd-mbr-01 -o $PRIMARY_IF -j ACCEPT 2>/dev/null || \
    sudo iptables -A FORWARD -i cvd-mbr-01 -o $PRIMARY_IF -j ACCEPT
sudo iptables -C FORWARD -i $PRIMARY_IF -o cvd-mbr-01 -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || \
    sudo iptables -A FORWARD -i $PRIMARY_IF -o cvd-mbr-01 -m state --state RELATED,ESTABLISHED -j ACCEPT

# Start dnsmasq DNS proxy on the mobile bridge (if not already running)
if ! pgrep -f 'dnsmasq.*cvd-mbr-01' > /dev/null; then
    sudo killall dnsmasq 2>/dev/null || true
    sudo dnsmasq --interface=cvd-mbr-01 --bind-interfaces --listen-address=10.0.2.2 \
        --no-dhcp-interface=cvd-mbr-01 --server=8.8.8.8 --server=8.8.4.4 \
        --pid-file=/var/run/dnsmasq-cvd.pid --log-facility=/var/log/dnsmasq-cvd.log 2>/dev/null
fi

# Configure each connected device
for serial in $(adb devices | grep -oP '\S+(?=\s+device$)'); do
    adb -s $serial root 2>/dev/null || true
    sleep 1

    # Set DNS properties
    adb -s $serial shell 'setprop net.dns1 8.8.8.8'
    adb -s $serial shell 'setprop net.dns2 8.8.4.4'

    # Disable captive portal detection (prevents Android marking network invalid)
    adb -s $serial shell 'settings put global captive_portal_mode 0'
    adb -s $serial shell 'settings put global private_dns_mode off'

    # Enable WiFi and connect to VirtWifi
    adb -s $serial shell 'svc wifi enable'
    sleep 3
    adb -s $serial shell 'cmd wifi connect-network VirtWifi open' 2>/dev/null || true
    sleep 3

    # Redirect WiFi routing table default route through mobile bridge
    # (OpenWrt VM's WAN is isolated inside crosvm, can't reach internet)
    adb -s $serial shell 'ip route replace default via 10.0.2.2 dev buried_eth0 table wlan0' 2>/dev/null || true

    # DNAT all DNS queries to our working dnsmasq on the mobile bridge
    adb -s $serial shell 'iptables -t nat -C OUTPUT -p udp --dport 53 ! -d 10.0.2.2 -j DNAT --to-destination 10.0.2.2:53 2>/dev/null' || \
        adb -s $serial shell 'iptables -t nat -A OUTPUT -p udp --dport 53 ! -d 10.0.2.2 -j DNAT --to-destination 10.0.2.2:53'
    adb -s $serial shell 'iptables -t nat -C OUTPUT -p tcp --dport 53 ! -d 10.0.2.2 -j DNAT --to-destination 10.0.2.2:53 2>/dev/null' || \
        adb -s $serial shell 'iptables -t nat -A OUTPUT -p tcp --dport 53 ! -d 10.0.2.2 -j DNAT --to-destination 10.0.2.2:53'

    # MASQUERADE WiFi-sourced traffic going through mobile bridge
    # (fixes source IP so host can route replies back)
    adb -s $serial shell 'iptables -t nat -C POSTROUTING -o buried_eth0 -s 192.168.99.0/25 -j MASQUERADE 2>/dev/null' || \
        adb -s $serial shell 'iptables -t nat -A POSTROUTING -o buried_eth0 -s 192.168.99.0/25 -j MASQUERADE'
    adb -s $serial shell 'iptables -t nat -C POSTROUTING -o buried_eth0 ! -s 10.0.2.0/24 -j MASQUERADE 2>/dev/null' || \
        adb -s $serial shell 'iptables -t nat -A POSTROUTING -o buried_eth0 ! -s 10.0.2.0/24 -j MASQUERADE'
done

echo "NETSETUP:done"
"""
    try:
        await run_ssh_command(cmd, timeout=120.0)
    except Exception:
        pass  # Best-effort; don't fail device launch if networking setup fails


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
        # Set up networking in the background so devices get internet access
        asyncio.ensure_future(_setup_device_networking())
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


async def run_adb_command(serial: str, command: str, timeout: float = 15.0) -> tuple[str, str, int]:
    """Run an ADB shell command on a device. Returns (stdout, stderr, returncode)."""
    full_cmd = f"adb -s {serial} shell '{command}'"
    return await run_ssh_command(full_cmd, timeout=timeout)


async def take_screenshot_base64(serial: str) -> str | None:
    """Take a screenshot and return it as base64-encoded PNG."""
    cmd = f"""
adb -s {serial} shell screencap -p /sdcard/screenshot.png 2>/dev/null && \
adb -s {serial} pull /sdcard/screenshot.png /tmp/device_screenshot.png 2>/dev/null && \
base64 -w 0 /tmp/device_screenshot.png 2>/dev/null && \
rm -f /tmp/device_screenshot.png
"""
    stdout, stderr, rc = await run_ssh_command(cmd, timeout=15.0)
    if rc == 0 and stdout.strip():
        return stdout.strip()
    return None


async def install_gapps(serial: str) -> tuple[bool, str]:
    """Install Google Apps (GApps) on a Cuttlefish device.

    Uses MindTheGapps for x86_64 Android 14.
    """
    gapps_script = f"""
set -e

SERIAL="{serial}"
GAPPS_DIR="/home/administrator/gapps"
GAPPS_ZIP="$GAPPS_DIR/MindTheGapps-14.0.0-x86_64.zip"

# Check if GApps are already extracted
if [ ! -d "$GAPPS_DIR/system" ]; then
    mkdir -p "$GAPPS_DIR"
    # Try to extract from cached zip
    if [ -f "$GAPPS_ZIP" ]; then
        cd "$GAPPS_DIR"
        unzip -o "$GAPPS_ZIP" 2>/dev/null || true
    else
        echo "GAPPS_STATUS:no_zip"
        exit 1
    fi
fi

# Verify extracted files exist
if [ ! -d "$GAPPS_DIR/system/product" ] && [ ! -d "$GAPPS_DIR/system/priv-app" ]; then
    echo "GAPPS_STATUS:no_extracted_files"
    exit 1
fi

# Check if device is available
adb -s $SERIAL wait-for-device 2>/dev/null
BOOT=$(adb -s $SERIAL shell getprop sys.boot_completed 2>/dev/null | tr -d '\\r')
if [ "$BOOT" != "1" ]; then
    echo "GAPPS_STATUS:not_booted"
    exit 1
fi

# Check if GApps already installed
GPLAY=$(adb -s $SERIAL shell pm list packages 2>/dev/null | grep -c "com.android.vending" || true)
if [ "$GPLAY" -gt 0 ]; then
    echo "GAPPS_STATUS:already_installed"
    exit 0
fi

# Remount system as writable - need root + remount, then check if overlayfs needs a reboot
adb -s $SERIAL root 2>/dev/null
sleep 2
REMOUNT_OUT=$(adb -s $SERIAL remount 2>&1)
echo "$REMOUNT_OUT"

# If remount says "Now reboot your device", we need to reboot first to enable overlayfs
if echo "$REMOUNT_OUT" | grep -q "Now reboot"; then
    echo "GAPPS_STATUS:overlayfs_reboot"
    adb -s $SERIAL reboot 2>/dev/null
    sleep 5
    # Wait for device to come back
    for i in $(seq 1 60); do
        BOOT=$(adb -s $SERIAL shell getprop sys.boot_completed 2>/dev/null | tr -d '\\r')
        if [ "$BOOT" = "1" ]; then break; fi
        sleep 3
    done
    # Re-root and re-remount after overlayfs reboot
    adb -s $SERIAL root 2>/dev/null
    sleep 2
    adb -s $SERIAL remount 2>/dev/null
    sleep 1
else
    sleep 1
fi

# Push GApps files
PUSH_OK=0
if [ -d "$GAPPS_DIR/system/product" ]; then
    adb -s $SERIAL push "$GAPPS_DIR/system/product/." /system/product/ 2>&1 && PUSH_OK=1
fi
if [ -d "$GAPPS_DIR/system/system_ext" ]; then
    adb -s $SERIAL push "$GAPPS_DIR/system/system_ext/." /system/system_ext/ 2>&1
fi
if [ -d "$GAPPS_DIR/system/priv-app" ]; then
    adb -s $SERIAL push "$GAPPS_DIR/system/priv-app/." /system/priv-app/ 2>/dev/null
fi
if [ -d "$GAPPS_DIR/system/app" ]; then
    adb -s $SERIAL push "$GAPPS_DIR/system/app/." /system/app/ 2>/dev/null
fi
if [ -d "$GAPPS_DIR/system/framework" ]; then
    adb -s $SERIAL push "$GAPPS_DIR/system/framework/." /system/framework/ 2>/dev/null
fi
if [ -d "$GAPPS_DIR/system/etc" ]; then
    adb -s $SERIAL push "$GAPPS_DIR/system/etc/." /system/etc/ 2>/dev/null
fi

if [ "$PUSH_OK" = "0" ]; then
    echo "GAPPS_STATUS:push_failed"
    exit 1
fi

# Disable privapp permission enforcement
adb -s $SERIAL shell "sed -i 's/ro.control_privapp_permissions=enforce/ro.control_privapp_permissions=disable/' /vendor/build.prop" 2>/dev/null || true

# Set proper permissions
adb -s $SERIAL shell "chmod -R 755 /system/product/priv-app/ /system/product/app/ /system/system_ext/priv-app/ 2>/dev/null" || true

# Reboot to apply
adb -s $SERIAL reboot 2>/dev/null
echo "GAPPS_STATUS:installed_rebooting"
"""
    stdout, stderr, rc = await run_ssh_command(gapps_script, timeout=360.0)
    output = stdout + stderr

    if "GAPPS_STATUS:already_installed" in output:
        return True, "GApps already installed"
    elif "GAPPS_STATUS:installed_rebooting" in output:
        return True, "GApps installed, device rebooting"
    elif "GAPPS_STATUS:no_zip" in output:
        return False, "GApps zip not found. Please download MindTheGapps manually."
    elif "GAPPS_STATUS:not_booted" in output:
        return False, "Device not fully booted yet"
    elif "GAPPS_STATUS:downloading" in output and "GAPPS_STATUS:installed_rebooting" in output:
        return True, "GApps downloaded and installed, device rebooting"
    else:
        return False, f"GApps installation failed: {output[:500]}"


# --- File Manager ---

async def list_device_files(serial: str, path: str = "/sdcard") -> list[dict]:
    """List files in a directory on the device."""
    safe_path = path.replace("'", "'\"'\"'")
    cmd = f"adb -s {serial} shell 'ls -la \"{safe_path}\" 2>/dev/null' | tail -n +2"
    stdout, _, rc = await run_ssh_command(cmd, timeout=10.0)
    files = []
    for line in stdout.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 8:
            perms = parts[0]
            size = parts[4] if len(parts) >= 5 else "0"
            name = " ".join(parts[7:]) if len(parts) >= 8 else parts[-1]
            if name in (".", ".."):
                continue
            is_dir = perms.startswith("d")
            try:
                size_int = int(size)
            except ValueError:
                size_int = 0
            files.append({"name": name, "is_dir": is_dir, "size": size_int, "permissions": perms})
    return files


async def pull_file_base64(serial: str, remote_path: str) -> str | None:
    """Pull a file from device and return as base64."""
    safe_path = remote_path.replace("'", "'\"'\"'")
    cmd = f"adb -s {serial} pull '{safe_path}' /tmp/pulled_file 2>/dev/null && base64 -w 0 /tmp/pulled_file && rm -f /tmp/pulled_file"
    stdout, _, rc = await run_ssh_command(cmd, timeout=30.0)
    if rc == 0 and stdout.strip():
        return stdout.strip()
    return None


async def push_file_from_base64(serial: str, remote_path: str, data_b64: str) -> bool:
    """Push a file to the device from base64 data."""
    safe_path = remote_path.replace("'", "'\"'\"'")
    cmd = f"echo '{data_b64}' | base64 -d > /tmp/push_file && adb -s {serial} push /tmp/push_file '{safe_path}' 2>/dev/null && rm -f /tmp/push_file && echo 'PUSH_OK'"
    stdout, _, _ = await run_ssh_command(cmd, timeout=30.0)
    return "PUSH_OK" in stdout


async def delete_device_file(serial: str, remote_path: str) -> bool:
    """Delete a file on the device."""
    safe_path = remote_path.replace("'", "'\"'\"'")
    cmd = f"adb -s {serial} shell 'rm -rf \"{safe_path}\"' 2>/dev/null && echo 'DEL_OK'"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return "DEL_OK" in stdout


# --- App Management ---

async def list_installed_apps(serial: str) -> list[dict]:
    """List installed apps on the device."""
    cmd = f"adb -s {serial} shell 'pm list packages -f 2>/dev/null'"
    stdout, _, _ = await run_ssh_command(cmd, timeout=15.0)
    apps = []
    for line in stdout.strip().split("\n"):
        if line.startswith("package:"):
            rest = line[8:]
            eq_pos = rest.rfind("=")
            if eq_pos > 0:
                apk_path = rest[:eq_pos]
                package = rest[eq_pos + 1:]
                apps.append({"package": package, "apk_path": apk_path})
    return apps


async def install_apk_from_base64(serial: str, data_b64: str, filename: str = "app.apk") -> tuple[bool, str]:
    """Install an APK on the device from base64 data."""
    cmd = f"echo '{data_b64}' | base64 -d > /tmp/{filename} && adb -s {serial} install -r /tmp/{filename} 2>&1 && rm -f /tmp/{filename}"
    stdout, stderr, rc = await run_ssh_command(cmd, timeout=60.0)
    output = stdout + stderr
    if "Success" in output:
        return True, "APK installed successfully"
    return False, f"Install failed: {output[:300]}"


async def uninstall_app(serial: str, package: str) -> tuple[bool, str]:
    """Uninstall an app from the device."""
    cmd = f"adb -s {serial} uninstall {package} 2>&1"
    stdout, stderr, _ = await run_ssh_command(cmd, timeout=15.0)
    output = stdout + stderr
    if "Success" in output:
        return True, "App uninstalled"
    return False, f"Uninstall failed: {output[:200]}"


async def force_stop_app(serial: str, package: str) -> bool:
    """Force stop an app."""
    cmd = f"adb -s {serial} shell am force-stop {package} 2>/dev/null && echo 'STOP_OK'"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return "STOP_OK" in stdout


async def clear_app_data(serial: str, package: str) -> bool:
    """Clear an app's data."""
    cmd = f"adb -s {serial} shell pm clear {package} 2>/dev/null"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return "Success" in stdout


# --- Screen Recording ---

async def start_screen_recording(serial: str, duration: int = 180) -> bool:
    """Start screen recording on the device (max 3 min)."""
    dur = min(duration, 180)
    cmd = f"adb -s {serial} shell 'nohup screenrecord --time-limit {dur} /sdcard/recording.mp4 > /dev/null 2>&1 &' && echo 'REC_STARTED'"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return "REC_STARTED" in stdout


async def stop_screen_recording(serial: str) -> bool:
    """Stop screen recording."""
    cmd = f"adb -s {serial} shell 'pkill -2 screenrecord 2>/dev/null; sleep 1' && echo 'REC_STOPPED'"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return "REC_STOPPED" in stdout


async def get_screen_recording_base64(serial: str) -> str | None:
    """Pull screen recording and return as base64."""
    cmd = f"adb -s {serial} pull /sdcard/recording.mp4 /tmp/recording.mp4 2>/dev/null && base64 -w 0 /tmp/recording.mp4 && rm -f /tmp/recording.mp4"
    stdout, _, rc = await run_ssh_command(cmd, timeout=30.0)
    if rc == 0 and stdout.strip():
        return stdout.strip()
    return None


# --- Clipboard ---

async def get_clipboard(serial: str) -> str:
    """Get clipboard content from the device."""
    cmd = f"adb -s {serial} shell 'service call clipboard 2 s16 com.android.shell 2>/dev/null | grep -o \"[a-zA-Z0-9 .,!?@#$%^&*()_+-=]\\+\"' 2>/dev/null"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return stdout.strip()


async def set_clipboard(serial: str, text: str) -> bool:
    """Set clipboard content on the device."""
    safe_text = text.replace("'", "'\"'\"'")
    cmd = f"adb -s {serial} shell 'am broadcast -a clipper.set -e text \"{safe_text}\"' 2>/dev/null; adb -s {serial} shell input text '{safe_text}' 2>/dev/null; echo 'CLIP_SET'"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return "CLIP_SET" in stdout


# --- Network Throttling ---

async def set_network_throttle(serial: str, profile: str) -> tuple[bool, str]:
    """Set network throttling on the device. Profiles: none, 2g, 3g, 4g, lossy."""
    profiles = {
        "none": "tc qdisc del dev eth0 root 2>/dev/null; echo 'NET_OK'",
        "2g": "tc qdisc replace dev eth0 root netem delay 300ms 50ms loss 2% rate 50kbit && echo 'NET_OK'",
        "3g": "tc qdisc replace dev eth0 root netem delay 100ms 20ms loss 1% rate 1mbit && echo 'NET_OK'",
        "4g": "tc qdisc replace dev eth0 root netem delay 30ms 10ms loss 0.1% rate 10mbit && echo 'NET_OK'",
        "lossy": "tc qdisc replace dev eth0 root netem delay 200ms 100ms loss 10% rate 500kbit && echo 'NET_OK'",
    }
    if profile not in profiles:
        return False, f"Unknown profile: {profile}"
    cmd = f"adb -s {serial} shell '{profiles[profile]}'"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return "NET_OK" in stdout, f"Network set to {profile}"


# --- Snapshots ---

async def create_snapshot(serial: str, snapshot_name: str) -> tuple[bool, str]:
    """Create a snapshot of the device state."""
    safe_name = snapshot_name.replace("'", "").replace(" ", "_")
    cmd = f"""
SERIAL="{serial}"
SNAP_DIR="/home/administrator/snapshots/{safe_name}"
mkdir -p "$SNAP_DIR"
# Save device properties
adb -s $SERIAL shell getprop > "$SNAP_DIR/properties.txt" 2>/dev/null
# Save installed packages list
adb -s $SERIAL shell pm list packages > "$SNAP_DIR/packages.txt" 2>/dev/null
# Create a data backup
adb -s $SERIAL backup -f "$SNAP_DIR/backup.ab" -all -noapk 2>/dev/null &
sleep 3
adb -s $SERIAL shell input keyevent 61 2>/dev/null
adb -s $SERIAL shell input keyevent 66 2>/dev/null
wait
echo "SNAPSHOT_CREATED"
"""
    stdout, _, _ = await run_ssh_command(cmd, timeout=60.0)
    if "SNAPSHOT_CREATED" in stdout:
        return True, f"Snapshot '{safe_name}' created"
    return False, "Failed to create snapshot"


async def list_snapshots() -> list[dict]:
    """List all snapshots."""
    cmd = "ls -lt /home/administrator/snapshots/ 2>/dev/null | tail -n +2 | awk '{print $NF}'"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    snapshots = []
    for line in stdout.strip().split("\n"):
        name = line.strip()
        if name:
            snapshots.append({"name": name})
    return snapshots


async def delete_snapshot(snapshot_name: str) -> bool:
    """Delete a snapshot."""
    safe_name = snapshot_name.replace("'", "").replace("/", "").replace("..", "")
    cmd = f"rm -rf /home/administrator/snapshots/{safe_name} && echo 'DEL_OK'"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return "DEL_OK" in stdout


# --- WebSocket Terminal ---

async def create_adb_shell_session(serial: str):
    """Create an SSH connection for interactive ADB shell. Returns the connection and process."""
    conn = await asyncssh.connect(
        SSH_HOST,
        port=SSH_PORT,
        username=SSH_USERNAME,
        password=SSH_PASSWORD,
        known_hosts=None,
        connect_timeout=10,
    )
    process = await conn.create_process(f"adb -s {serial} shell", encoding=None)
    return conn, process


# --- Logcat ---

async def create_logcat_session(serial: str, filter_tag: str = ""):
    """Create an SSH connection for streaming logcat. Returns the connection and process."""
    tag_filter = f" -s {filter_tag}" if filter_tag else ""
    conn = await asyncssh.connect(
        SSH_HOST,
        port=SSH_PORT,
        username=SSH_USERNAME,
        password=SSH_PASSWORD,
        known_hosts=None,
        connect_timeout=10,
    )
    process = await conn.create_process(f"adb -s {serial} logcat{tag_filter}", encoding=None)
    return conn, process


# --- Device Health Monitoring ---

async def get_device_health(serial: str) -> dict:
    """Get device CPU, memory, battery, temperature stats."""
    cmd = f"""
echo '===CPU===' && adb -s {serial} shell top -bn1 -m5 2>/dev/null | head -5
echo '===MEMORY===' && adb -s {serial} shell cat /proc/meminfo 2>/dev/null | head -5
echo '===BATTERY===' && adb -s {serial} shell dumpsys battery 2>/dev/null | head -15
echo '===TEMP===' && adb -s {serial} shell cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null
echo '===UPTIME===' && adb -s {serial} shell uptime 2>/dev/null
echo '===DISK===' && adb -s {serial} shell df /data 2>/dev/null | tail -1
"""
    stdout, _, _ = await run_ssh_command(cmd, timeout=15.0)
    result = {
        "cpu_usage": 0.0,
        "mem_total_mb": 0,
        "mem_available_mb": 0,
        "mem_used_mb": 0,
        "battery_level": -1,
        "battery_status": "unknown",
        "battery_temp": 0.0,
        "temperature_c": 0.0,
        "uptime": "",
        "disk_total_mb": 0,
        "disk_used_mb": 0,
    }
    section = ""
    for line in stdout.split("\n"):
        line = line.strip()
        if line.startswith("==="):
            section = line.strip("=")
            continue
        if section == "CPU" and "cpu" in line.lower() and "%" in line:
            try:
                # Parse top output for CPU idle
                parts = line.split()
                for p in parts:
                    if "idle" in p.lower() or p.endswith("%idle"):
                        idle = float(p.replace("%idle", "").replace("%", ""))
                        result["cpu_usage"] = round(100 - idle, 1)
                        break
            except (ValueError, IndexError):
                pass
        elif section == "MEMORY":
            if "MemTotal" in line:
                try:
                    result["mem_total_mb"] = int(line.split()[1]) // 1024
                except (ValueError, IndexError):
                    pass
            elif "MemAvailable" in line:
                try:
                    result["mem_available_mb"] = int(line.split()[1]) // 1024
                except (ValueError, IndexError):
                    pass
        elif section == "BATTERY":
            if "level:" in line:
                try:
                    result["battery_level"] = int(line.split(":")[-1].strip())
                except ValueError:
                    pass
            elif "status:" in line:
                val = line.split(":")[-1].strip()
                statuses = {"1": "unknown", "2": "charging", "3": "discharging", "4": "not charging", "5": "full"}
                result["battery_status"] = statuses.get(val, val)
            elif "temperature:" in line:
                try:
                    result["battery_temp"] = int(line.split(":")[-1].strip()) / 10.0
                except ValueError:
                    pass
        elif section == "TEMP" and line.isdigit():
            result["temperature_c"] = int(line) / 1000.0
        elif section == "UPTIME" and line:
            result["uptime"] = line
        elif section == "DISK" and line and not line.startswith("Filesystem"):
            parts = line.split()
            if len(parts) >= 4:
                try:
                    result["disk_total_mb"] = int(parts[1]) // 1024
                    result["disk_used_mb"] = int(parts[2]) // 1024
                except (ValueError, IndexError):
                    pass

    result["mem_used_mb"] = result["mem_total_mb"] - result["mem_available_mb"]
    return result


# --- GPS Location Simulation ---

async def set_gps_location(serial: str, latitude: float, longitude: float, altitude: float = 0.0) -> bool:
    """Set mock GPS location on device."""
    cmd = f"""
adb -s {serial} shell settings put secure mock_location 1 2>/dev/null
adb -s {serial} emu geo fix {longitude} {latitude} {altitude} 2>/dev/null && echo 'GPS_OK' || \
adb -s {serial} shell am broadcast -a android.intent.action.MOCK_LOCATION --ef latitude {latitude} --ef longitude {longitude} 2>/dev/null && echo 'GPS_OK'
"""
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return "GPS_OK" in stdout


# --- SMS/Call Simulation ---

async def send_sms(serial: str, phone_number: str, message: str) -> bool:
    """Send a simulated SMS to the device."""
    safe_msg = message.replace("'", "'\\''")
    cmd = f"adb -s {serial} emu sms send {phone_number} '{safe_msg}' 2>/dev/null && echo 'SMS_OK'"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return "SMS_OK" in stdout


async def make_call(serial: str, phone_number: str) -> bool:
    """Simulate an incoming call."""
    cmd = f"adb -s {serial} emu gsm call {phone_number} 2>/dev/null && echo 'CALL_OK'"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return "CALL_OK" in stdout


async def end_call(serial: str, phone_number: str) -> bool:
    """End a simulated call."""
    cmd = f"adb -s {serial} emu gsm cancel {phone_number} 2>/dev/null && echo 'CANCEL_OK'"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return "CANCEL_OK" in stdout


# --- Locale Switching ---

async def set_device_locale(serial: str, locale: str) -> bool:
    """Change device locale (e.g., 'en-US', 'fr-FR', 'ja-JP')."""
    cmd = f"""
adb -s {serial} shell "setprop persist.sys.locale {locale}; setprop persist.sys.language $(echo {locale} | cut -d- -f1); setprop persist.sys.country $(echo {locale} | cut -d- -f2); settings put system system_locales {locale}" 2>/dev/null
adb -s {serial} shell am broadcast -a android.intent.action.LOCALE_CHANGED 2>/dev/null && echo 'LOCALE_OK'
"""
    stdout, _, _ = await run_ssh_command(cmd, timeout=15.0)
    return "LOCALE_OK" in stdout


async def get_device_locale(serial: str) -> str:
    """Get current device locale."""
    cmd = f"adb -s {serial} shell getprop persist.sys.locale 2>/dev/null"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    return stdout.strip() or "en-US"


# --- Session Recording (full interaction session) ---

async def get_device_processes(serial: str) -> list[dict]:
    """List running processes on device."""
    cmd = f"adb -s {serial} shell ps -A -o PID,USER,NAME,RSS 2>/dev/null | head -50"
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    procs = []
    for line in stdout.strip().split("\n")[1:]:  # skip header
        parts = line.split()
        if len(parts) >= 4:
            procs.append({
                "pid": parts[0],
                "user": parts[1],
                "name": parts[2],
                "rss_kb": int(parts[3]) if parts[3].isdigit() else 0,
            })
    return procs


# --- Device Pools / Tags ---
# (Managed via database - tags stored in device_metadata)

# --- Cost Tracking ---
# (Managed via database - usage sessions tracked)

# --- Remote Debugging ---

async def get_webview_debug_url(serial: str) -> str:
    """Get Chrome DevTools debugging URL for WebViews."""
    cmd = f"""
adb -s {serial} shell cat /proc/net/unix 2>/dev/null | grep devtools | head -1
"""
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    if "devtools" in stdout:
        return f"chrome://inspect/#devices"
    return ""


# --- Screenshot Comparison ---

async def take_screenshot_for_comparison(serial: str) -> str | None:
    """Take a screenshot and return base64 for comparison."""
    return await take_screenshot_base64(serial)


# --- Automated Testing ---

async def run_monkey_test(serial: str, package: str, event_count: int = 500) -> tuple[bool, str]:
    """Run Android monkey test on a package."""
    cmd = f"adb -s {serial} shell monkey -p {package} -v {event_count} 2>&1 | tail -20"
    stdout, stderr, rc = await run_ssh_command(cmd, timeout=120.0)
    output = stdout + stderr
    success = "Events injected" in output and "CRASH" not in output
    return success, output


# --- Session Recording (input events capture) ---

async def start_input_recording(serial: str) -> bool:
    """Start recording input events from the device."""
    cmd = f"adb -s {serial} shell 'nohup getevent -t /dev/input/event0 > /sdcard/input_recording.txt 2>&1 &'"
    stdout, stderr, rc = await run_ssh_command(cmd, timeout=10.0)
    return rc == 0


async def stop_input_recording(serial: str) -> bool:
    """Stop recording input events."""
    cmd = f"adb -s {serial} shell 'pkill -f getevent || true'"
    stdout, stderr, rc = await run_ssh_command(cmd, timeout=10.0)
    return True


async def get_input_recording(serial: str) -> str:
    """Get the recorded input events as text."""
    cmd = f"adb -s {serial} shell cat /sdcard/input_recording.txt 2>/dev/null | tail -500"
    stdout, stderr, rc = await run_ssh_command(cmd, timeout=10.0)
    return stdout


async def replay_input_recording(serial: str, events_text: str) -> bool:
    """Replay recorded input events on the device."""
    # Parse getevent format and replay with sendevent
    lines = events_text.strip().split('\n')
    replay_cmds = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        # getevent format: [timestamp] /dev/input/eventX: type code value
        parts = line.split()
        if len(parts) >= 4:
            try:
                dev = parts[1].rstrip(':') if ':' in parts[1] else '/dev/input/event0'
                etype = int(parts[-3], 16) if len(parts) >= 4 else 0
                ecode = int(parts[-2], 16) if len(parts) >= 4 else 0
                evalue = int(parts[-1], 16) if len(parts) >= 4 else 0
                replay_cmds.append(f"sendevent {dev} {etype} {ecode} {evalue}")
            except (ValueError, IndexError):
                continue
    if not replay_cmds:
        return False
    # Execute in batches
    batch_size = 50
    for i in range(0, len(replay_cmds), batch_size):
        batch = replay_cmds[i:i+batch_size]
        cmd_str = " && ".join(batch)
        cmd = f"adb -s {serial} shell '{cmd_str}'"
        await run_ssh_command(cmd, timeout=30.0)
        await asyncio.sleep(0.1)
    return True


# --- Custom Boot Animation ---

async def set_boot_animation(serial: str, animation_name: str) -> bool:
    """Set a custom boot animation on the device."""
    # Create a simple boot animation based on the name/brand
    cmd = f"""adb -s {serial} shell 'su -c "
        mkdir -p /data/local/bootanimation
        echo \"Custom boot: {animation_name}\" > /data/local/bootanimation/desc.txt
        setprop persist.sys.bootanim.custom {animation_name}
    "'"""
    stdout, stderr, rc = await run_ssh_command(cmd, timeout=15.0)
    return rc == 0


async def get_device_branding(serial: str) -> dict:
    """Get current device branding info."""
    cmd = f"""adb -s {serial} shell '
        echo "model=$(getprop ro.product.model)"
        echo "brand=$(getprop ro.product.brand)"
        echo "manufacturer=$(getprop ro.product.manufacturer)"
        echo "device=$(getprop ro.product.device)"
        echo "bootanim=$(getprop persist.sys.bootanim.custom)"
    '"""
    stdout, _, _ = await run_ssh_command(cmd, timeout=10.0)
    result = {}
    for line in stdout.strip().split('\n'):
        if '=' in line:
            k, v = line.split('=', 1)
            result[k.strip()] = v.strip()
    return result


async def set_device_branding(serial: str, brand: str, model: str, manufacturer: str) -> bool:
    """Set device branding properties."""
    cmd = f"""adb -s {serial} shell 'su -c "
        setprop ro.product.brand {brand}
        setprop ro.product.model {model}
        setprop ro.product.manufacturer {manufacturer}
    "'"""
    stdout, stderr, rc = await run_ssh_command(cmd, timeout=15.0)
    return rc == 0


# --- Smart Device Recommendations ---

def get_smart_recommendations(app_category: str, target_audience: str, budget: str) -> list[dict]:
    """Generate smart device configuration recommendations based on criteria."""
    recommendations = []

    # Base configs by audience
    audience_configs = {
        "general": {"ram_mb": 4096, "storage_gb": 64, "cpus": 4},
        "power_users": {"ram_mb": 8192, "storage_gb": 128, "cpus": 8},
        "budget": {"ram_mb": 2048, "storage_gb": 32, "cpus": 2},
        "enterprise": {"ram_mb": 6144, "storage_gb": 128, "cpus": 6},
        "gaming": {"ram_mb": 12288, "storage_gb": 256, "cpus": 8},
        "developers": {"ram_mb": 8192, "storage_gb": 128, "cpus": 8},
    }

    # Category-specific adjustments
    category_profiles = {
        "social_media": [
            {"name": "Samsung Galaxy S24 Ultra", "reason": "Most popular flagship for social apps", "android": "14"},
            {"name": "Google Pixel 8", "reason": "Pure Android experience, great camera APIs", "android": "14"},
            {"name": "Samsung Galaxy A54", "reason": "Mid-range leader, huge market share", "android": "14"},
        ],
        "gaming": [
            {"name": "Samsung Galaxy S24 Ultra", "reason": "Top GPU performance", "android": "14"},
            {"name": "OnePlus 12", "reason": "High refresh rate, gaming optimized", "android": "14"},
            {"name": "Google Pixel 9 Pro", "reason": "Smooth performance, latest Android", "android": "15"},
        ],
        "enterprise": [
            {"name": "Samsung Galaxy S24 Ultra", "reason": "Samsung Knox security", "android": "14"},
            {"name": "Google Pixel 8", "reason": "Guaranteed security updates", "android": "14"},
            {"name": "Samsung Galaxy A54", "reason": "Cost-effective fleet device", "android": "14"},
        ],
        "ecommerce": [
            {"name": "Samsung Galaxy S24 Ultra", "reason": "Large screen for product browsing", "android": "14"},
            {"name": "Google Pixel 8", "reason": "Standard Android for testing", "android": "14"},
            {"name": "Low-End Device", "reason": "Test performance on budget devices", "android": "13"},
        ],
        "media": [
            {"name": "Samsung Galaxy Tab S9", "reason": "Tablet testing for media consumption", "android": "14"},
            {"name": "Google Pixel 9 Pro", "reason": "High-res display for media apps", "android": "15"},
            {"name": "Samsung Galaxy S24 Ultra", "reason": "Large screen, HDR support", "android": "14"},
        ],
    }

    base_config = audience_configs.get(target_audience, audience_configs["general"])
    profiles = category_profiles.get(app_category, category_profiles["social_media"])

    for i, profile in enumerate(profiles):
        config = base_config.copy()
        # Adjust based on priority
        if budget == "low" and i > 0:
            config["ram_mb"] = max(2048, config["ram_mb"] // 2)
            config["storage_gb"] = max(32, config["storage_gb"] // 2)
            config["cpus"] = max(2, config["cpus"] // 2)

        recommendations.append({
            "profile_name": profile["name"],
            "android_version": profile["android"],
            "reason": profile["reason"],
            "priority": ["high", "medium", "low"][i] if i < 3 else "low",
            "config": config,
        })

    # Add version-specific recommendations
    recommendations.append({
        "profile_name": "Low-End Device",
        "android_version": "13",
        "reason": "Always test on low-end devices to catch performance issues",
        "priority": "medium",
        "config": {"ram_mb": 2048, "storage_gb": 32, "cpus": 2},
    })

    return recommendations
