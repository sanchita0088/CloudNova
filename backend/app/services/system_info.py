import platform
import socket
import logging
import time
import threading
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Safe import for psutil
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    logger.warning("psutil package is not installed. Host hardware metrics will use basic platform detection.")


def get_local_ip() -> str:
    """
    Attempts to determine the primary local IP address of the host machine.
    """
    try:
        # Create a dummy UDP socket to auto-resolve active outgoing network IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


def get_network_interfaces() -> List[Dict[str, str]]:
    """
    Lists active non-loopback network interface names and IP addresses.
    """
    interfaces = []
    if not PSUTIL_AVAILABLE:
        return [{"name": "eth0", "address": get_local_ip()}]

    try:
        addrs = psutil.net_if_addrs()
        for iface_name, iface_addrs in addrs.items():
            for addr in iface_addrs:
                if addr.family == socket.AF_INET and not addr.address.startswith("127."):
                    interfaces.append({
                        "name": iface_name,
                        "address": addr.address
                    })
    except Exception as e:
        logger.error(f"Error fetching network interfaces: {e}")
        interfaces.append({"name": "primary", "address": get_local_ip()})

    return interfaces if interfaces else [{"name": "primary", "address": get_local_ip()}]


# ---------------------------------------------------------------------------
# Host facts change rarely, but get_system_info() is called on every
# /sandbox/state and /system/info request (and each does an outbound UDP
# connect to 8.8.8.8 + NIC enumeration). Cache the result with a short TTL so
# a polled dashboard doesn't repeat that work on every request.
# ---------------------------------------------------------------------------
_SYSTEM_INFO_TTL_SECONDS = 60.0
_system_info_cache: Dict[str, Any] = {"data": None, "ts": 0.0}
_system_info_lock = threading.Lock()


def get_system_info() -> Dict[str, Any]:
    """
    Returns comprehensive hardware and operating system details for the host
    machine, cached for up to _SYSTEM_INFO_TTL_SECONDS to avoid repeating the
    outbound-IP probe and NIC enumeration on every request.
    """
    now = time.time()
    cached = _system_info_cache["data"]
    if cached is not None and (now - _system_info_cache["ts"]) < _SYSTEM_INFO_TTL_SECONDS:
        return cached

    info = _build_system_info()
    with _system_info_lock:
        _system_info_cache["data"] = info
        _system_info_cache["ts"] = time.time()
    return info


def _build_system_info() -> Dict[str, Any]:
    """
    Returns comprehensive hardware and operating system details for the host machine.
    """
    system_name = platform.system()  # 'Darwin', 'Linux', 'Windows'
    if system_name == 'Darwin':
        os_display = f"macOS {platform.mac_ver()[0]}"
    elif system_name == 'Linux':
        os_display = f"Linux ({platform.release()})"
    elif system_name == 'Windows':
        os_display = f"Windows {platform.release()}"
    else:
        os_display = f"{system_name} {platform.release()}"

    hostname = socket.gethostname()
    architecture = platform.machine()
    processor_name = platform.processor() or architecture

    # Default fallback values
    cpu_cores_logical = 4
    cpu_cores_physical = 4
    total_ram_gb = 8.0
    available_ram_gb = 4.0
    ram_usage_pct = 50.0
    total_disk_gb = 256.0
    used_disk_gb = 128.0
    disk_usage_pct = 50.0

    if PSUTIL_AVAILABLE:
        try:
            cpu_cores_logical = psutil.cpu_count(logical=True) or 4
            cpu_cores_physical = psutil.cpu_count(logical=False) or cpu_cores_logical
            
            vm = psutil.virtual_memory()
            total_ram_gb = round(vm.total / (1024 ** 3), 2)
            available_ram_gb = round(vm.available / (1024 ** 3), 2)
            ram_usage_pct = round(vm.percent, 1)

            disk = psutil.disk_usage('/')
            total_disk_gb = round(disk.total / (1024 ** 3), 2)
            used_disk_gb = round(disk.used / (1024 ** 3), 2)
            disk_usage_pct = round(disk.percent, 1)
        except Exception as e:
            logger.error(f"Error sampling psutil system metrics: {e}")

    return {
        "os": os_display,
        "platform": system_name,
        "hostname": hostname,
        "architecture": architecture,
        "processor": processor_name,
        "cpu_cores_logical": cpu_cores_logical,
        "cpu_cores_physical": cpu_cores_physical,
        "memory": {
            "total_gb": total_ram_gb,
            "available_gb": available_ram_gb,
            "used_pct": ram_usage_pct
        },
        "disk": {
            "total_gb": total_disk_gb,
            "used_gb": used_disk_gb,
            "used_pct": disk_usage_pct
        },
        "ip": get_local_ip(),
        "network_interfaces": get_network_interfaces(),
        "psutil_available": PSUTIL_AVAILABLE
    }
