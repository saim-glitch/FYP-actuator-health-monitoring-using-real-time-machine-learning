"""
RAW TELEMETRY TEST - See EVERYTHING coming through COM14
Shows exactly what is and isn't being received
"""

from pymavlink import mavutil
import time

PORT = 'COM14'
BAUD = 57600

print("")
print("=" * 60)
print("   RAW TELEMETRY TEST - COM14")
print("=" * 60)

# Connect with NO filtering
print("\n[1] Connecting...")
conn = mavutil.mavlink_connection(PORT, baud=BAUD, source_system=255)

print("[2] Waiting for ANY heartbeat...")
conn.wait_heartbeat(timeout=30)
print(f"    ✅ Got heartbeat! Sys={conn.target_system} Comp={conn.target_component}")

# Force accept everything
conn.target_system = 0
conn.target_component = 0

print("")
print("=" * 60)
print("   READING EVERYTHING (30 seconds)")
print("   Wave hand in front of IR sensors during this test!")
print("=" * 60)
print("")

# Track what message types we see
msg_types_seen = {}
pi_messages = 0
pixhawk_messages = 0
total = 0
start_time = time.time()

try:
    while time.time() - start_time < 30:
        msg = conn.recv_match(blocking=False)

        if msg is None:
            msg = conn.recv_msg()

        if msg is None:
            time.sleep(0.01)
            continue

        mt = msg.get_type()
        if mt == 'BAD_DATA':
            continue

        total += 1

        # Count message types
        if mt not in msg_types_seen:
            msg_types_seen[mt] = 0
        msg_types_seen[mt] += 1

        # Get source system info
        src_sys = msg.get_srcSystem() if hasattr(msg, 'get_srcSystem') else '?'
        src_comp = msg.get_srcComponent() if hasattr(msg, 'get_srcComponent') else '?'

        # ══════════════════════════════════
        #  CHECK FOR PI DATA
        # ══════════════════════════════════

        if mt == 'NAMED_VALUE_INT':
            name = msg.name
            if isinstance(name, bytes):
                name = name.decode('utf-8', errors='ignore')
            name = name.strip('\x00')
            pi_messages += 1
            print(f"   ✅ [{total}] NAMED_VALUE_INT | name={name} | value={msg.value} | from sys={src_sys} comp={src_comp}")

        elif mt == 'STATUSTEXT':
            text = msg.text
            if isinstance(text, bytes):
                text = text.decode('utf-8', errors='ignore')
            text = text.strip('\x00')
            pi_messages += 1
            print(f"   ✅ [{total}] STATUSTEXT | \"{text}\" | from sys={src_sys} comp={src_comp}")

        elif mt == 'HEARTBEAT':
            armed = "ARMED" if (msg.base_mode & 128) else "DISARMED"
            mav_type = msg.type
            # Type 18 = onboard controller (Pi), Type 2 = quadrotor
            source = "RASPBERRY PI" if mav_type == 18 else "PIXHAWK" if mav_type == 2 else f"TYPE={mav_type}"
            if mav_type == 18:
                pi_messages += 1
                print(f"   🟢 [{total}] HEARTBEAT from {source} | sys={src_sys} comp={src_comp} | {armed}")
            else:
                pixhawk_messages += 1
                print(f"   🔵 [{total}] HEARTBEAT from {source} | sys={src_sys} comp={src_comp} | {armed}")

        else:
            pixhawk_messages += 1
            # Only print first occurrence of each type
            if msg_types_seen[mt] <= 2:
                print(f"   🔵 [{total}] {mt} | from sys={src_sys} comp={src_comp}")

        # Progress update every 5 seconds
        elapsed = time.time() - start_time
        if total % 50 == 0:
            remaining = 30 - elapsed
            print(f"\n   --- {total} msgs | {pi_messages} from Pi | {pixhawk_messages} from Pixhawk | {remaining:.0f}s left ---\n")

except KeyboardInterrupt:
    pass

# ══════════════════════════════════
#  FINAL REPORT
# ══════════════════════════════════
print("")
print("=" * 60)
print("   RESULTS")
print("=" * 60)
print(f"   Total messages:       {total}")
print(f"   From Raspberry Pi:    {pi_messages}")
print(f"   From Pixhawk:         {pixhawk_messages}")
print("")
print("   Message types received:")
for mt, count in sorted(msg_types_seen.items(), key=lambda x: -x[1]):
    marker = "🟢 PI" if mt in ('NAMED_VALUE_INT', 'STATUSTEXT') else "🔵"
    print(f"     {marker} {mt}: {count}")

print("")
print("=" * 60)

if pi_messages > 0:
    print("   ✅ RASPBERRY PI DATA IS COMING THROUGH!")
    print("   Your obstacle_detector.py is working correctly.")
    print("   You can now run receiver.py + App.js")
elif total > 0 and pixhawk_messages > 0:
    print("   ⚠️  PIXHAWK DATA WORKS but NO PI DATA")
    print("")
    print("   This means:")
    print("   - Pixhawk TELEM1 (telemetry radio) works ✅")
    print("   - But Pi data is NOT reaching TELEM1")
    print("")
    print("   FIX: In Mission Planner set these parameters:")
    print("     SERIAL2_PROTOCOL = 2")
    print("     SERIAL2_BAUD = 57")
    print("   Then reboot Pixhawk")
elif total > 0:
    print("   ⚠️  Getting heartbeats but no other data")
    print("   Check Pixhawk parameters:")
    print("     SERIAL1_PROTOCOL = 2")
    print("     SERIAL1_BAUD = 57")
    print("     SERIAL2_PROTOCOL = 2")
    print("     SERIAL2_BAUD = 57")
else:
    print("   ❌ NO DATA AT ALL")
    print("   - Check telemetry radio connection")
    print("   - Check COM port number")
    print("   - Make sure Pixhawk is powered")

print("=" * 60)