"""
SIMPLE TELEMETRY TEST
Just reads COM3 and prints everything received.
No Flask, no frontend, just raw data.

RUN:
  python test_telemetry.py
"""

from pymavlink import mavutil
import time

# ==========================================
#  CHANGE THIS TO YOUR PORT
# ==========================================
PORT = 'COM14'
BAUD = 57600

print("")
print("=" * 50)
print("   TELEMETRY TEST")
print("=" * 50)
print(f"   Port: {PORT}")
print(f"   Baud: {BAUD}")
print("=" * 50)
print("")

# Connect
print("[1] Opening port...")
try:
    conn = mavutil.mavlink_connection(PORT, baud=BAUD)
    print("    Port opened!")
except Exception as e:
    print(f"    FAILED: {e}")
    print("")
    print("    FIX:")
    print("    - Check Device Manager for correct COM port")
    print("    - Close Mission Planner (it locks the port)")
    print("    - Try COM4, COM5, etc.")
    exit()

# Wait for heartbeat
print("")
print("[2] Waiting for heartbeat (30 sec timeout)...")
print("    Make sure Pixhawk is powered on!")
print("")

try:
    conn.wait_heartbeat(timeout=30)
    print(f"    ✅ HEARTBEAT RECEIVED!")
    print(f"    System ID:    {conn.target_system}")
    print(f"    Component ID: {conn.target_component}")
except Exception as e:
    print(f"    ❌ NO HEARTBEAT: {e}")
    print("")
    print("    POSSIBLE PROBLEMS:")
    print("    - Pixhawk not powered on")
    print("    - Telemetry radios not paired")
    print("    - Wrong COM port")
    print("    - Wrong baud rate (try 115200)")
    exit()

# Read all messages
print("")
print("=" * 50)
print("   READING ALL MESSAGES (Ctrl+C to stop)")
print("=" * 50)
print("")

count = 0
obstacle_count = 0

try:
    while True:
        msg = conn.recv_match(blocking=True, timeout=2)

        if msg is None:
            print("   ... waiting for data ...")
            continue

        msg_type = msg.get_type()
        count += 1

        # ── Print important messages ──

        if msg_type == 'HEARTBEAT':
            armed = "ARMED" if (msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED) else "DISARMED"
            print(f"   [{count}] HEARTBEAT | {armed} | Mode: {msg.custom_mode}")

        elif msg_type == 'GLOBAL_POSITION_INT':
            lat = msg.lat / 1e7
            lon = msg.lon / 1e7
            alt = msg.alt / 1000.0
            print(f"   [{count}] GPS | Lat: {lat:.6f} | Lon: {lon:.6f} | Alt: {alt:.1f}m")

        elif msg_type == 'GPS_RAW_INT':
            print(f"   [{count}] GPS_RAW | Sats: {msg.satellites_visible} | Fix: {msg.fix_type}")

        elif msg_type == 'SYS_STATUS':
            v = msg.voltage_battery / 1000.0 if msg.voltage_battery > 0 else 0
            b = msg.battery_remaining if msg.battery_remaining >= 0 else 0
            print(f"   [{count}] BATTERY | {v:.2f}V | {b}%")

        elif msg_type == 'ATTITUDE':
            import math
            r = round(math.degrees(msg.roll), 1)
            p = round(math.degrees(msg.pitch), 1)
            y = round(math.degrees(msg.yaw), 1)
            print(f"   [{count}] ATTITUDE | Roll: {r}° | Pitch: {p}° | Yaw: {y}°")

        elif msg_type == 'VFR_HUD':
            print(f"   [{count}] SPEED | Air: {msg.airspeed:.1f} | Ground: {msg.groundspeed:.1f} | Alt: {msg.alt:.1f}")

        elif msg_type == 'SERVO_OUTPUT_RAW':
            print(f"   [{count}] SERVOS | M1:{msg.servo1_raw} M2:{msg.servo2_raw} M3:{msg.servo3_raw} M4:{msg.servo4_raw}")

        # ══════════════════════════════════
        #  OBSTACLE DATA FROM RASPBERRY PI
        # ══════════════════════════════════

        elif msg_type == 'NAMED_VALUE_INT':
            name = msg.name.strip('\x00')
            value = msg.value
            if 'OBS' in name:
                obstacle_count += 1
                print(f"   [{count}] 🚨 OBSTACLE DATA | {name} = {value} | (obstacle msg #{obstacle_count})")
            else:
                print(f"   [{count}] NAMED_INT | {name} = {value}")

        elif msg_type == 'STATUSTEXT':
            text = msg.text.strip('\x00')
            if 'OBS' in text or 'BLOCKED' in text or 'CLEAR' in text:
                print(f"   [{count}] 🚨 OBSTACLE TEXT | {text}")
            else:
                print(f"   [{count}] STATUS | {text}")

        # Skip noisy messages, print others
        elif msg_type not in ('RAW_IMU', 'SCALED_IMU2', 'SCALED_PRESSURE',
                               'MEMINFO', 'MISSION_CURRENT', 'NAV_CONTROLLER_OUTPUT',
                               'RC_CHANNELS', 'RC_CHANNELS_RAW', 'PARAM_VALUE',
                               'TIMESYNC', 'SYSTEM_TIME', 'AHRS', 'AHRS2',
                               'VIBRATION', 'BATTERY_STATUS', 'EKF_STATUS_REPORT',
                               'LOCAL_POSITION_NED', 'POSITION_TARGET_GLOBAL_INT',
                               'TERRAIN_REPORT', 'WIND', 'HWSTATUS', 'POWER_STATUS',
                               'SENSOR_OFFSETS', 'MOUNT_STATUS', 'HOME_POSITION'):
            print(f"   [{count}] {msg_type}")

        # Print summary every 50 messages
        if count % 50 == 0:
            print("")
            print(f"   ── {count} messages received | {obstacle_count} obstacle messages ──")
            print("")

except KeyboardInterrupt:
    print("")
    print("=" * 50)
    print(f"   STOPPED")
    print(f"   Total messages:    {count}")
    print(f"   Obstacle messages: {obstacle_count}")
    print("=" * 50)