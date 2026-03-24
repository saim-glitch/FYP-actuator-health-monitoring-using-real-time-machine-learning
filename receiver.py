"""
╔══════════════════════════════════════════════════════════════╗
║   UAV DIGITAL TWIN — RPM MONITORING BACKEND                 ║
║   Receives 4-wing RPM data from IR sensors via telemetry     ║
║   Analyzes drone health and makes fly/land decisions         ║
║   UET Taxila FYP Project                                     ║
╚══════════════════════════════════════════════════════════════╝

DATA FLOW:
  [4 IR Sensors on wings] → blade pass counting → RPM
  → [Raspberry Pi] → MAVLink serial → [Pixhawk TELEM2]
  → telemetry radio → [THIS SCRIPT on laptop]
  → AI analysis → WebSocket → [React Digital Twin]

INSTALL:  pip install pymavlink flask flask-socketio flask-cors
RUN:      python receiver.py
"""

from pymavlink import mavutil
from flask import Flask, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
import threading
import time
import math
from datetime import datetime
from collections import deque

# ==========================================
#  YOUR TELEMETRY PORT
# ==========================================
MAVLINK_CONNECTION = 'COM14'
MAVLINK_BAUD = 57600

WEB_HOST = '0.0.0.0'
WEB_PORT = 5000
EMIT_RATE = 0.3

# ==========================================
# FLASK
# ==========================================
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# ==========================================
# WING / MOTOR MAPPING
# ==========================================
WINGS = [
    {'id': 1, 'name': 'Front Right', 'short': 'FR', 'gpio': 17},
    {'id': 2, 'name': 'Rear Left',   'short': 'RL', 'gpio': 27},
    {'id': 3, 'name': 'Front Left',  'short': 'FL', 'gpio': 22},
    {'id': 4, 'name': 'Rear Right',  'short': 'RR', 'gpio': 23},
]

# ==========================================
# RPM HEALTH THRESHOLDS
# ==========================================
RPM_NOMINAL_MIN = 3000      # Below this = motor issue
RPM_NOMINAL_MAX = 7000      # Above this = over-spinning
RPM_IMBALANCE_THRESHOLD = 15  # % difference from average = imbalance
RPM_CRITICAL_THRESHOLD = 30   # % difference = LAND NOW

# ==========================================
# DATA STORE
# ==========================================
uav = {
    # 4-wing RPM from IR sensors
    'motor_rpms': [0, 0, 0, 0],
    'rpm_health': ['IDLE', 'IDLE', 'IDLE', 'IDLE'],  # GOOD, WARNING, CRITICAL, IDLE

    # Flight data from Pixhawk
    'latitude': 33.68520, 'longitude': 72.99850,
    'altitude': 0.0, 'relative_altitude': 0.0,
    'speed': 0.0, 'groundspeed': 0.0,
    'heading': 0, 'climb_rate': 0.0,
    'satellites': 0, 'gps_fix': 0,

    # Attitude
    'roll': 0.0, 'pitch': 0.0, 'yaw': 0.0,

    # Battery
    'battery': 0.0, 'voltage': 0.0, 'current': 0.0,

    # System
    'armed': False, 'flight_mode': 'UNKNOWN',
    'system_status': 'UNINIT',
    'vibration': 0.0, 'temperature': 0.0, 'wind': 0.0,

    # Servo outputs from Pixhawk (for comparison)
    'servo_outputs': [0, 0, 0, 0],

    # Connection
    'connected': False, 'last_heartbeat': 0, 'messages_received': 0,

    # AI Decision
    'drone_decision': 'STANDBY',   # FLY_SAFE, WARNING, LAND_NOW, STANDBY
    'decision_reason': 'Waiting for data...',
    'anomaly': 0,
    'warnings': [],
    'rpm_balance_score': 100,       # 0-100, 100 = perfect balance
    'overall_health': 0,
}

# History buffers
rpm_history = deque(maxlen=120)
battery_history = deque(maxlen=60)
decision_history = deque(maxlen=60)
flight_path = deque(maxlen=500)

# RPM event log
rpm_events = {
    'total_warnings': 0,
    'total_critical': 0,
    'per_wing_warnings': [0, 0, 0, 0],
    'log': deque(maxlen=100),
}


# ==========================================
# RPM ANALYSIS ENGINE
# ==========================================
def analyze_rpms():
    """Core AI: Analyze 4-motor RPMs and make fly/land decision."""
    rpms = uav['motor_rpms']
    warnings = []
    decision = 'FLY_SAFE'
    reason = 'All motors operating normally'
    health_scores = [100, 100, 100, 100]

    # Get active motors (RPM > 100 = spinning)
    active = [(i, r) for i, r in enumerate(rpms) if r > 100]
    idle = [(i, r) for i, r in enumerate(rpms) if r <= 100]

    # ── If no motors spinning ──
    if len(active) == 0:
        uav['drone_decision'] = 'STANDBY'
        uav['decision_reason'] = 'Motors idle — drone on ground'
        uav['rpm_health'] = ['IDLE', 'IDLE', 'IDLE', 'IDLE']
        uav['rpm_balance_score'] = 100
        uav['anomaly'] = 0
        uav['warnings'] = []
        return

    # ── Calculate average RPM of active motors ──
    avg_rpm = sum(r for _, r in active) / len(active)

    # ── Analyze each motor ──
    for i in range(4):
        rpm = rpms[i]

        if rpm <= 100:
            # Motor not spinning while others are
            if len(active) >= 2:
                uav['rpm_health'][i] = 'CRITICAL'
                health_scores[i] = 0
                warnings.append(f'🛑 Motor {i+1} ({WINGS[i]["short"]}): STOPPED while others at {avg_rpm:.0f} RPM!')
                decision = 'LAND_NOW'
                reason = f'Motor {i+1} ({WINGS[i]["name"]}) has stopped!'
                log_rpm_event(i, 'CRITICAL', f'Motor stopped (others at {avg_rpm:.0f})')
            else:
                uav['rpm_health'][i] = 'IDLE'
            continue

        # Calculate deviation from average
        deviation_pct = abs(rpm - avg_rpm) / avg_rpm * 100 if avg_rpm > 0 else 0

        # Check absolute range
        if rpm < RPM_NOMINAL_MIN:
            uav['rpm_health'][i] = 'WARNING'
            health_scores[i] = 50
            warnings.append(f'⚠️ Motor {i+1} ({WINGS[i]["short"]}): Low RPM ({rpm}) — below {RPM_NOMINAL_MIN}')
            if decision != 'LAND_NOW':
                decision = 'WARNING'
                reason = f'Motor {i+1} RPM too low ({rpm})'
            log_rpm_event(i, 'WARNING', f'Low RPM: {rpm}')

        elif rpm > RPM_NOMINAL_MAX:
            uav['rpm_health'][i] = 'WARNING'
            health_scores[i] = 60
            warnings.append(f'⚠️ Motor {i+1} ({WINGS[i]["short"]}): High RPM ({rpm}) — above {RPM_NOMINAL_MAX}')
            if decision != 'LAND_NOW':
                decision = 'WARNING'
                reason = f'Motor {i+1} RPM too high ({rpm})'
            log_rpm_event(i, 'WARNING', f'High RPM: {rpm}')

        # Check balance (deviation from average)
        elif deviation_pct > RPM_CRITICAL_THRESHOLD:
            uav['rpm_health'][i] = 'CRITICAL'
            health_scores[i] = 20
            warnings.append(f'🛑 Motor {i+1} ({WINGS[i]["short"]}): {deviation_pct:.0f}% off balance! ({rpm} vs avg {avg_rpm:.0f})')
            decision = 'LAND_NOW'
            reason = f'Motor {i+1} severely imbalanced ({deviation_pct:.0f}% deviation)'
            log_rpm_event(i, 'CRITICAL', f'{deviation_pct:.0f}% imbalance ({rpm} vs {avg_rpm:.0f})')

        elif deviation_pct > RPM_IMBALANCE_THRESHOLD:
            uav['rpm_health'][i] = 'WARNING'
            health_scores[i] = 70
            warnings.append(f'⚠️ Motor {i+1} ({WINGS[i]["short"]}): {deviation_pct:.0f}% off balance ({rpm} vs avg {avg_rpm:.0f})')
            if decision != 'LAND_NOW':
                decision = 'WARNING'
                reason = f'Motor {i+1} RPM imbalance ({deviation_pct:.0f}%)'
            log_rpm_event(i, 'WARNING', f'{deviation_pct:.0f}% imbalance')

        else:
            uav['rpm_health'][i] = 'GOOD'
            health_scores[i] = 100

    # ── Calculate balance score ──
    if len(active) >= 2:
        active_rpms = [r for _, r in active]
        avg = sum(active_rpms) / len(active_rpms)
        if avg > 0:
            max_dev = max(abs(r - avg) / avg * 100 for r in active_rpms)
            uav['rpm_balance_score'] = max(0, round(100 - max_dev * 2))
        else:
            uav['rpm_balance_score'] = 100
    else:
        uav['rpm_balance_score'] = 100

    # ── Battery warnings ──
    if 0 < uav['battery'] < 25:
        warnings.append(f'🔋 Low battery: {uav["battery"]:.0f}% — consider landing')
        if decision == 'FLY_SAFE':
            decision = 'WARNING'
            reason = f'Battery low ({uav["battery"]:.0f}%)'
    if 0 < uav['battery'] < 10:
        decision = 'LAND_NOW'
        reason = f'Battery critical ({uav["battery"]:.0f}%)!'

    # ── Vibration warnings ──
    if uav['vibration'] > 60:
        warnings.append(f'📳 High vibration: {uav["vibration"]:.1f}%')
        if decision == 'FLY_SAFE':
            decision = 'WARNING'
            reason = 'High vibration detected'

    # ── Attitude warnings ──
    if abs(uav['roll']) > 35 or abs(uav['pitch']) > 35:
        warnings.append(f'↗️ Excessive tilt: Roll={uav["roll"]:.1f}° Pitch={uav["pitch"]:.1f}°')
        decision = 'LAND_NOW'
        reason = f'Dangerous tilt angle detected'

    # ── GPS warnings ──
    if 0 < uav['satellites'] < 6:
        warnings.append(f'📡 Low GPS: {uav["satellites"]} satellites')

    # ── Update state ──
    uav['drone_decision'] = decision
    uav['decision_reason'] = reason
    uav['anomaly'] = 1 if decision in ('WARNING', 'LAND_NOW') else 0
    uav['warnings'] = warnings
    uav['overall_health'] = round(sum(health_scores) / 4)


def log_rpm_event(motor_idx, severity, message):
    """Log RPM events."""
    ts = datetime.now().strftime('%H:%M:%S')
    rpm_events['log'].append({
        'time': ts,
        'motor': motor_idx + 1,
        'wing': WINGS[motor_idx]['short'],
        'name': WINGS[motor_idx]['name'],
        'severity': severity,
        'message': message,
        'rpm': uav['motor_rpms'][motor_idx],
    })
    if severity == 'WARNING':
        rpm_events['total_warnings'] += 1
        rpm_events['per_wing_warnings'][motor_idx] += 1
    elif severity == 'CRITICAL':
        rpm_events['total_critical'] += 1
        rpm_events['per_wing_warnings'][motor_idx] += 1


def calc_health():
    b = min(100, max(0, uav['battery']))
    r = uav['rpm_balance_score']
    g = min(100, uav['satellites'] * 7) if uav['satellites'] > 0 else 50
    v = max(0, 100 - uav['vibration'])
    return round(b * 0.25 + r * 0.35 + g * 0.15 + v * 0.25)


def calc_eff():
    se = 100 - abs(uav['groundspeed'] - 15) * 3
    ae = 100 - abs(uav['relative_altitude'] - 100) * 0.5
    return max(0, min(100, round((se + ae) / 2 - uav['wind'] * 2)))


# ==========================================
# MAVLINK RECEIVER
# ==========================================
def mavlink_receiver():
    print("\n" + "=" * 60)
    print("   📡 RPM TELEMETRY RECEIVER")
    print("=" * 60)
    print(f"   Port: {MAVLINK_CONNECTION} @ {MAVLINK_BAUD}")
    print("=" * 60)

    try:
        conn = mavutil.mavlink_connection(MAVLINK_CONNECTION, baud=MAVLINK_BAUD, source_system=255)
        print("   Waiting for heartbeat...")
        conn.wait_heartbeat(timeout=30)
        print(f"   ✅ Heartbeat! Sys={conn.target_system} Comp={conn.target_component}")
        conn.target_system = 0
        conn.target_component = 0
        uav['connected'] = True
    except Exception as e:
        print(f"   ❌ Failed: {e}")
        print("\n   🎮 Starting DEMO mode...\n")
        uav['connected'] = False
        demo_mode()
        return

    print("\n   Receiving RPM data...\n")

    while True:
        try:
            msg = conn.recv_match(blocking=False)
            if msg is None:
                msg = conn.recv_msg()
            if msg is None:
                time.sleep(0.01)
                continue

            mt = msg.get_type()
            if mt == 'BAD_DATA':
                continue

            uav['messages_received'] += 1

            if mt == 'HEARTBEAT':
                uav['last_heartbeat'] = time.time()
                uav['connected'] = True
                uav['armed'] = bool(msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED)
                try:
                    mm = conn.mode_mapping()
                    if mm:
                        for n, v in mm.items():
                            if v == msg.custom_mode: uav['flight_mode'] = n; break
                except: pass
                sm = {0:'UNINIT',1:'BOOT',2:'CALIBRATING',3:'STANDBY',4:'ACTIVE',5:'CRITICAL',6:'EMERGENCY'}
                uav['system_status'] = sm.get(msg.system_status, 'UNKNOWN')

            elif mt == 'GLOBAL_POSITION_INT':
                uav['latitude'] = msg.lat / 1e7
                uav['longitude'] = msg.lon / 1e7
                uav['altitude'] = msg.alt / 1000.0
                uav['relative_altitude'] = msg.relative_alt / 1000.0
                uav['heading'] = msg.hdg / 100.0 if msg.hdg != 65535 else 0
                flight_path.append([uav['latitude'], uav['longitude']])

            elif mt == 'GPS_RAW_INT':
                uav['satellites'] = msg.satellites_visible

            elif mt == 'ATTITUDE':
                uav['roll'] = round(math.degrees(msg.roll), 1)
                uav['pitch'] = round(math.degrees(msg.pitch), 1)
                uav['yaw'] = round(math.degrees(msg.yaw), 1)

            elif mt == 'VFR_HUD':
                uav['speed'] = round(msg.groundspeed, 1)
                uav['groundspeed'] = round(msg.groundspeed, 1)
                uav['climb_rate'] = round(msg.climb, 2)

            elif mt == 'SYS_STATUS':
                if msg.voltage_battery > 0: uav['voltage'] = round(msg.voltage_battery / 1000.0, 2)
                if msg.current_battery >= 0: uav['current'] = round(msg.current_battery / 100.0, 2)
                if msg.battery_remaining >= 0: uav['battery'] = msg.battery_remaining

            elif mt == 'VIBRATION':
                mx = max(msg.vibration_x, msg.vibration_y, msg.vibration_z)
                uav['vibration'] = round(min(100, (mx / 60) * 100), 1)

            elif mt == 'WIND':
                uav['wind'] = round(msg.speed, 1)

            elif mt == 'SERVO_OUTPUT_RAW':
                uav['servo_outputs'] = [msg.servo1_raw, msg.servo2_raw, msg.servo3_raw, msg.servo4_raw]

            # ── RPM DATA FROM RASPBERRY PI ──
            elif mt == 'NAMED_VALUE_INT':
                name = msg.name
                if isinstance(name, bytes): name = name.decode('utf-8', errors='ignore')
                name = name.strip('\x00').strip()

                # M1_RPM, M2_RPM, M3_RPM, M4_RPM
                if name.startswith('M') and name.endswith('_RPM'):
                    try:
                        idx = int(name[1]) - 1
                        if 0 <= idx < 4:
                            old_rpm = uav['motor_rpms'][idx]
                            uav['motor_rpms'][idx] = msg.value
                            if old_rpm == 0 and msg.value > 100:
                                print(f"   🔄 Motor {idx+1} ({WINGS[idx]['short']}) started: {msg.value} RPM")
                    except: pass

                # M1_OBS style (treat as RPM drop)
                elif name.startswith('M') and name.endswith('_OBS'):
                    try:
                        idx = int(name[1]) - 1
                        if 0 <= idx < 4 and msg.value == 1:
                            uav['motor_rpms'][idx] = 0  # Blocked = 0 RPM
                            print(f"   🛑 Motor {idx+1} ({WINGS[idx]['short']}) BLOCKED → 0 RPM")
                    except: pass

            elif mt == 'STATUSTEXT':
                text = msg.text
                if isinstance(text, bytes): text = text.decode('utf-8', errors='ignore')
                text = text.strip('\x00').strip()

                # Parse RPM status: "RPM:5200,5180,5220,5190"
                if text.startswith('RPM:'):
                    try:
                        for i, v in enumerate(text[4:].split(',')[:4]):
                            uav['motor_rpms'][i] = int(v.strip())
                    except: pass

                # FR:BLOCKED etc → set RPM to 0
                elif ':' in text:
                    parts = text.split(':')
                    short = parts[0].strip()
                    status = parts[1].strip() if len(parts) > 1 else ''
                    im = {'FR': 0, 'RL': 1, 'FL': 2, 'RR': 3}
                    if short in im:
                        if status == 'BLOCKED':
                            uav['motor_rpms'][im[short]] = 0
                        print(f"   📨 {text}")
                    else:
                        print(f"   📨 {text}")

            # Run RPM analysis after every relevant message
            analyze_rpms()

        except Exception as e:
            print(f"   ⚠️ {e}")
            time.sleep(0.1)


# ==========================================
# DEMO MODE
# ==========================================
def demo_mode():
    import random
    print("   🎮 DEMO MODE — Simulating 4-motor RPM data\n")

    wps = [[33.68520,72.99850],[33.68500,72.99880],[33.68480,72.99920],
           [33.68450,72.99960],[33.68420,73.00000],[33.68400,73.00030],
           [33.68380,73.00060],[33.68350,73.00090],[33.68320,73.00120],
           [33.68280,73.00150]]
    wi, d, batt = 0, 1, 92.0
    base_rpm = 5200

    while True:
        wi += d
        if wi >= len(wps): wi = len(wps)-2; d = -1
        elif wi < 0: wi = 1; d = 1
        wp = wps[wi]
        batt = max(15, batt - random.random() * 0.08)

        # Simulate RPMs with realistic variance
        rpms = [round(base_rpm + random.uniform(-120, 120)) for _ in range(4)]

        # Occasionally simulate issues
        roll = random.uniform(-3, 3)
        r = random.random()
        if r > 0.97:
            # Critical: one motor drops
            bad = random.randint(0, 3)
            rpms[bad] = round(rpms[bad] * random.uniform(0.1, 0.4))
        elif r > 0.93:
            # Warning: one motor slightly off
            bad = random.randint(0, 3)
            rpms[bad] = round(rpms[bad] * random.uniform(0.7, 0.85))

        uav.update({
            'motor_rpms': rpms,
            'latitude': wp[0]+random.uniform(-0.00002,0.00002),
            'longitude': wp[1]+random.uniform(-0.00002,0.00002),
            'altitude': round(45+random.random()*15,1),
            'relative_altitude': round(45+random.random()*15,1),
            'speed': round(6+random.random()*6,1),
            'groundspeed': round(6+random.random()*6,1),
            'heading': round(random.uniform(0,360),1),
            'satellites': random.randint(10,16),
            'roll': round(roll,1),
            'pitch': round(random.uniform(-3,3),1),
            'yaw': round(random.uniform(-180,180),1),
            'battery': round(batt,1),
            'voltage': round(10.5+batt*0.02,2),
            'current': round(8+random.random()*5,2),
            'temperature': round(32+random.random()*8,1),
            'vibration': round(10+random.random()*20,1),
            'wind': round(2+random.random()*6,1),
            'armed': True, 'flight_mode': 'AUTO',
            'system_status': 'ACTIVE', 'connected': True,
        })

        flight_path.append(wp)
        analyze_rpms()
        time.sleep(1.0)


# ==========================================
# EMITTER
# ==========================================
def data_emitter():
    while True:
        now = datetime.now()
        ts = now.strftime('%H:%M:%S')

        rpms = uav['motor_rpms']
        rpm_history.append({
            'time': ts,
            'm1': rpms[0], 'm2': rpms[1], 'm3': rpms[2], 'm4': rpms[3],
        })
        battery_history.append({'time': now.strftime('%H:%M'), 'value': round(uav['battery'], 1)})
        decision_history.append({'time': ts, 'decision': uav['drone_decision'], 'balance': uav['rpm_balance_score']})

        h = calc_health()
        uav['overall_health'] = h

        socketio.emit('uav_data', {
            'motorRPMs': uav['motor_rpms'],
            'rpmHealth': uav['rpm_health'],
            'rpmBalanceScore': uav['rpm_balance_score'],
            'droneDecision': uav['drone_decision'],
            'decisionReason': uav['decision_reason'],
            'overallHealth': h,

            'totalWarnings': rpm_events['total_warnings'],
            'totalCritical': rpm_events['total_critical'],
            'perWingWarnings': rpm_events['per_wing_warnings'],
            'rpmEventLog': list(rpm_events['log']),

            'latitude': uav['latitude'], 'longitude': uav['longitude'],
            'altitude': uav['altitude'], 'relative_altitude': uav['relative_altitude'],
            'speed': uav['speed'], 'groundspeed': uav['groundspeed'],
            'heading': uav['heading'], 'satellites': uav['satellites'],
            'roll': uav['roll'], 'pitch': uav['pitch'], 'yaw': uav['yaw'],
            'battery': uav['battery'], 'voltage': uav['voltage'],
            'current': uav['current'], 'temperature': uav['temperature'],
            'armed': uav['armed'], 'flight_mode': uav['flight_mode'],
            'system_status': uav['system_status'],
            'vibration': uav['vibration'], 'wind': uav['wind'],

            'anomaly': uav['anomaly'], 'warnings': uav['warnings'],
            'flightEfficiency': calc_eff(),
            'flightTimeLeft': round(uav['battery'] * 0.3) if uav['current'] > 0 else 0,

            'rpmHistory': list(rpm_history),
            'batteryHistory': list(battery_history),
            'decisionHistory': list(decision_history),
            'flightPath': list(flight_path),

            'connected': uav['connected'],
            'messages_received': uav['messages_received'],
            'serverTime': now.isoformat(),
        })
        time.sleep(EMIT_RATE)


# ==========================================
# API
# ==========================================
@app.route('/')
def index():
    return jsonify({
        'status': 'RPM Monitor Running',
        'decision': uav['drone_decision'],
        'rpms': uav['motor_rpms'],
        'balance': uav['rpm_balance_score'],
        'connected': uav['connected'],
    })

@app.route('/api/data')
def get_data(): return jsonify(uav)

@socketio.on('connect')
def on_connect():
    print("   🌐 Frontend connected!")
    socketio.emit('connection_status', {'connected': uav['connected'], 'mode': 'LIVE' if uav['connected'] else 'DEMO'})

@socketio.on('disconnect')
def on_disconnect():
    print("   🔌 Frontend disconnected")


# ==========================================
# MAIN
# ==========================================
if __name__ == '__main__':
    print("\n╔══════════════════════════════════════════════════════════╗")
    print("║   UAV DIGITAL TWIN — RPM MONITORING SYSTEM              ║")
    print("║   4-Wing RPM Analysis + Health Decisions                 ║")
    print("║   UET Taxila FYP                                        ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print(f"\n   Telemetry: {MAVLINK_CONNECTION} @ {MAVLINK_BAUD}")
    print(f"   Server:    http://localhost:{WEB_PORT}\n")

    threading.Thread(target=mavlink_receiver, daemon=True).start()
    time.sleep(2)
    threading.Thread(target=data_emitter, daemon=True).start()

    print(f"   🚀 Backend: http://localhost:{WEB_PORT}")
    print(f"   🌐 Frontend: http://localhost:3000\n")
    socketio.run(app, host=WEB_HOST, port=WEB_PORT, debug=False, allow_unsafe_werkzeug=True)