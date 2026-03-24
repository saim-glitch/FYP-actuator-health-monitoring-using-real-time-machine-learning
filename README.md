<p align="center">
  <img src="https://img.shields.io/badge/UAV-Digital%20Twin-00d9ff?style=for-the-badge&logo=drone&logoColor=white" alt="UAV Digital Twin"/>
  <img src="https://img.shields.io/badge/Status-Active-00e676?style=for-the-badge" alt="Status"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Python-3.10-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/MAVLink-2.0-ff9800?style=for-the-badge" alt="MAVLink"/>
</p>

<h1 align="center">🚁 UAV Actuator Health Monitoring<br/>Using Real-Time Machine Learning</h1>

<p align="center">
  <strong>Final Year Project — UET Taxila, Department of Telecom Engineering</strong><br/>
  <em>Real-time 4-wing RPM monitoring system with AI-powered fly/land decision engine</em>
</p>

<p align="center">
  <a href="#-live-demo">Live Demo</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-setup">Setup</a> •
  <a href="#-hardware">Hardware</a> •
  <a href="#-ai-engine">AI Engine</a>
</p>

---

## 🎯 Problem Statement

Quadcopter drones rely on balanced motor RPMs for stable flight. If one motor's RPM drops or becomes imbalanced, the drone can crash — often with zero warning to the operator. Current consumer drones lack **real-time per-motor health monitoring** with intelligent decision-making.

## 💡 Our Solution

We built a **Digital Twin system** that monitors each motor's RPM using IR sensors mounted on all 4 wings, analyzes the data using machine learning algorithms, and makes real-time **FLY / CAUTION / LAND** decisions — all visualized on a beautiful web dashboard.

```
✅ FLY SAFE  → All 4 motors balanced, RPM within safe range
⚠️ CAUTION   → RPM imbalance detected (15-30% deviation)
🛑 LAND NOW  → Critical imbalance or motor failure detected
```

---

## 🌐 Live Demo

👉 **[View Live Dashboard](https://fyp-actuator-health-monitoring-using-real-time-machine-learning.vercel.app)**

> The demo runs with simulated RPM data. Watch the AI engine react in real-time as motors occasionally experience drops and imbalances.

---

## 🔬 How It Works

### 1. RPM Measurement (Hardware)
Each motor has an **IR sensor** mounted 5-10mm below the propeller. As each blade passes through the IR beam, it creates a pulse. The Raspberry Pi counts these pulses at **1000 Hz** to calculate RPM:

```
RPM = (pulses / blades_per_prop) × (60 / time_window)
```

### 2. Data Transmission (MAVLink)
The Raspberry Pi sends RPM data via **MAVLink protocol** through the Pixhawk flight controller's telemetry system:

```
IR Sensors → Raspberry Pi → serial → Pixhawk TELEM2 → radio → Laptop
```

### 3. AI Analysis (Decision Engine)
The backend analyzes all 4 motor RPMs every 300ms:

| Check | Threshold | Action |
|-------|-----------|--------|
| Motor stopped while others spin | 0 RPM | 🛑 LAND NOW |
| RPM deviation > 30% from average | Critical imbalance | 🛑 LAND NOW |
| RPM deviation 15-30% | Moderate imbalance | ⚠️ CAUTION |
| RPM below 3000 or above 7000 | Out of safe range | ⚠️ CAUTION |
| All motors within 15% | Balanced | ✅ FLY SAFE |

### 4. Visualization (Digital Twin)
A React dashboard displays everything in real-time with a drone-shaped layout, RPM gauges, history charts, health radar, and an AI decision panel.

---

## 🏗 Architecture

```
                    ON THE DRONE
┌─────────────────────────────────────────────────┐
│                                                 │
│  [IR1 FR]    [IR2 RL]    [IR3 FL]    [IR4 RR]  │
│   GPIO17      GPIO27      GPIO22      GPIO23    │
│      │           │           │           │      │
│      └───────────┴───────────┴───────────┘      │
│                      │                          │
│              [Raspberry Pi 4]                   │
│              obstacle_detector.py                │
│              (auto-starts on boot)              │
│                      │ serial                   │
│              [Pixhawk TELEM2]                   │
│                      │                          │
│              [Telemetry Radio] )))              │
└─────────────────────────────────────────────────┘

                          (((  WIRELESS LINK  )))

┌─────────────────────────────────────────────────┐
│                  ON THE LAPTOP                   │
│                                                 │
│          [USB Telemetry Radio]                   │
│                   │ COM14                        │
│           [receiver.py]  ← Backend              │
│                   │ WebSocket                    │
│            [React App.js]  ← Frontend           │
│                   │                             │
│           [Browser Dashboard]                    │
└─────────────────────────────────────────────────┘
```

---

## 📊 Dashboard Features

### RPM Monitor Tab
- **Drone-shaped layout** showing all 4 wing RPM gauges in correct positions
- **Real-time circular gauges** with color-coded health status (green/orange/red)
- **AI Decision panel** with FLY SAFE / CAUTION / LAND NOW verdict
- **RPM Balance Score** (0-100%) with progress bar
- **RPM History chart** tracking all 4 motors over time
- **Event log** recording every warning and critical event
- **System Health radar** chart

### Flight Data Tab
- **Live map** showing UAV position on UET Taxila campus (Leaflet + OpenStreetMap)
- **Flight path** tracking with route overlay
- **Telemetry gauges**: altitude, speed, GPS satellites, heading, roll, pitch, wind, vibration

### Battery Tab
- **Real-time battery monitoring**: voltage, current, temperature
- **Discharge history** chart
- **Low battery warnings** integrated with AI decision engine

---

## 🛠 Setup

### Prerequisites

| Component | Version |
|-----------|---------|
| Node.js | 16+ |
| Python | 3.10+ |
| React | 18+ |
| Raspberry Pi | 4 Model B |
| Pixhawk | 2.4.8 |

### Frontend Only (Demo Mode)

```bash
git clone https://github.com/saim-glitch/FYP-actuator-health-monitoring-using-real-time-machine-learning.git
cd FYP-actuator-health-monitoring-using-real-time-machine-learning
npm install
npm start
```

Open `http://localhost:3000` — runs with simulated RPM data.

### Full System (With Hardware)

**On Raspberry Pi:**
```bash
# Copy obstacle_detector.py to Pi
# Install auto-start service
sudo python3 obstacle_detector.py --install
```

**On Laptop:**
```bash
# Install Python dependencies
pip install pymavlink flask flask-socketio flask-cors

# Start backend (change COM port in receiver.py)
python receiver.py

# Start frontend
npm start
```

---

## 🔧 Hardware

### Components

| Component | Quantity | Purpose |
|-----------|----------|---------|
| Raspberry Pi 4 | 1 | Sensor processing + MAVLink |
| IR Obstacle Sensors | 4 | Blade pass detection (RPM) |
| Pixhawk 2.4.8 | 1 | Flight controller |
| Telemetry Radio (433MHz) | 2 | Wireless data link |
| 6S LiPo Battery | 1 | Drone power |
| Buck Converter (5V) | 1 | Pi + sensor power |
| BLDC Motors + ESCs | 4 | Quadcopter propulsion |

### Wiring

```
              ▲ FRONT
        ┌──────────────────┐
   IR3  ●  (Front Left)   ● IR1 (Front Right)
   GP22 │                  │ GP17
        │    [Pi + FC]     │
   IR2  ●  (Rear Left)    ● IR4 (Rear Right)
   GP27 │                  │ GP23
        └──────────────────┘
              ▼ REAR

Power: VCC + GND from flight controller 5V BEC
Signal: OUT wires to Raspberry Pi GPIOs
Common GND: Flight controller GND → Pi GND (Pin 6)
```

---

## 🧠 AI Engine

### Algorithms Used

**1. RPM Balance Analysis**
- Calculates deviation of each motor from the group average
- Weighted scoring: `balance = 100 - (max_deviation% × 2)`
- Thresholds tuned for quadcopter physics

**2. Anomaly Detection (Z-Score Variant)**
- Multi-sensor fusion: RPM, vibration, temperature, attitude
- Weighted anomaly score determines severity level

**3. Predictive Health Scoring**
- Combined health metric from: RPM balance (35%), battery (25%), vibration (25%), GPS (15%)
- Drives the overall system health percentage

**4. Decision Engine**
- Rule-based decision tree with sensor fusion
- Priority: Motor failure > RPM imbalance > Battery > Vibration > Attitude
- Real-time decisions at 300ms intervals

---

## 📁 Project Structure

```
├── src/
│   ├── App.js              # Main React dashboard (standalone simulation)
│   ├── index.js             # React entry point
│   └── index.css            # Global styles + Leaflet CSS
├── receiver.py              # Backend: MAVLink receiver + WebSocket server
├── obstacle_detector.py     # Raspberry Pi: 4-wing RPM detector (headless)
├── test_telemetry.py        # Debug: raw telemetry message viewer
├── package.json             # Node.js dependencies
└── README.md
```

---

## 🔑 Key Technologies

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18, Recharts, React-Leaflet | Dashboard UI, charts, map |
| Backend | Python, Flask-SocketIO | MAVLink parsing, WebSocket server |
| Protocol | MAVLink 2.0 | Drone communication standard |
| Hardware | Raspberry Pi 4, GPIO | Sensor interface |
| Flight Controller | Pixhawk (ArduPilot) | Autopilot + telemetry |
| Deployment | Vercel | Frontend hosting |

---

## 👥 Team

**Department of Telecom Engineering, UET Taxila**

This project was developed as a Final Year Project (FYP) for the Bachelor of Telecom Engineering program.

---

## 📜 License

This project is developed for academic purposes as part of the FYP at UET Taxila.

---

<p align="center">
  <strong>Built with ❤️ at UET Taxila</strong><br/>
  <em>Department of Telecom Engineering — 2024</em>
</p>
