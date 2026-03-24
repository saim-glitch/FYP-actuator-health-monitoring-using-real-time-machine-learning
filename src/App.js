import React, { useState, useEffect } from 'react';
import {
  FaPlane, FaHome, FaBatteryThreeQuarters, FaWifi,
  FaCheckCircle, FaExclamationTriangle, FaBolt,
  FaThermometerHalf, FaTachometerAlt, FaClock,
  FaBrain, FaChartLine, FaShieldAlt, FaCogs,
  FaMapMarkerAlt, FaHeartbeat, FaWind, FaSatellite,
  FaEye, FaSkullCrossbones,
} from 'react-icons/fa';
import { MdSensors, MdGpsFixed, MdSpeed } from 'react-icons/md';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, LineChart, Line,
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';

// ==========================================
// SELF-CONTAINED — No backend needed
// Built-in demo simulation for deployment
// When backend is available, switch to socket.io
// ==========================================

const WINGS = [
  { id:1, name:'Front Right', short:'FR', gpio:17, color:'#00d9ff' },
  { id:2, name:'Rear Left',   short:'RL', gpio:27, color:'#ff6b9d' },
  { id:3, name:'Front Left',  short:'FL', gpio:22, color:'#00ff88' },
  { id:4, name:'Rear Right',  short:'RR', gpio:23, color:'#ffab40' },
];

// Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({iconRetinaUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',iconUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'});
const uavIcon = new L.DivIcon({html:`<div style="background:linear-gradient(135deg,#00d9ff,#00ff88);width:36px;height:36px;border-radius:50%;display:flex;justify-content:center;align-items:center;box-shadow:0 0 25px rgba(0,217,255,0.9);border:3px solid white;animation:pulse 1.5s infinite"><span style="font-size:18px">🚁</span></div>`,className:'uav',iconSize:[36,36],iconAnchor:[18,18]});
const startIcon = new L.DivIcon({html:`<div style="background:linear-gradient(135deg,#ff6b9d,#e91e63);width:30px;height:30px;border-radius:50%;display:flex;justify-content:center;align-items:center;box-shadow:0 0 15px rgba(255,107,157,0.8);border:2px solid white"><span style="font-size:12px">📡</span></div>`,className:'s',iconSize:[30,30],iconAnchor:[15,15]});
const endIcon = new L.DivIcon({html:`<div style="background:linear-gradient(135deg,#ffab40,#ff9800);width:30px;height:30px;border-radius:50%;display:flex;justify-content:center;align-items:center;box-shadow:0 0 15px rgba(255,171,64,0.8);border:2px solid white"><span style="font-size:12px">🏛️</span></div>`,className:'e',iconSize:[30,30],iconAnchor:[15,15]});

const ROUTE = {
  start:{lat:33.68520,lng:72.99850}, end:{lat:33.68280,lng:73.00150},
  wps:[[33.68520,72.99850],[33.68500,72.99880],[33.68480,72.99920],[33.68450,72.99960],[33.68420,73.00000],[33.68400,73.00030],[33.68380,73.00060],[33.68350,73.00090],[33.68320,73.00120],[33.68280,73.00150]],
};

// Helpers
const MapUp = ({c}) => {const m=useMap();useEffect(()=>{m.setView(c,m.getZoom())},[c,m]);return null};
const Pulse = ({color}) => <div style={{width:10,height:10,borderRadius:'50%',background:color,boxShadow:`0 0 10px ${color}`,animation:'pulse 1.5s infinite'}}/>;

// ==========================================
// RPM ANALYSIS ENGINE (same as backend)
// ==========================================
const analyzeRPMs = (rpms) => {
  const active = rpms.filter(r => r > 100);
  if (active.length === 0) return { decision: 'STANDBY', reason: 'Motors idle — drone on ground', health: ['IDLE','IDLE','IDLE','IDLE'], balance: 100, anomaly: 0, warnings: [] };

  const avg = active.reduce((a,b) => a+b, 0) / active.length;
  let decision = 'FLY_SAFE', reason = 'All motors operating normally';
  const health = ['GOOD','GOOD','GOOD','GOOD'];
  const warnings = [];

  for (let i = 0; i < 4; i++) {
    const rpm = rpms[i];
    if (rpm <= 100 && active.length >= 2) {
      health[i] = 'CRITICAL';
      warnings.push(`🛑 Motor ${i+1} (${WINGS[i].short}): STOPPED while others at ${avg.toFixed(0)} RPM!`);
      decision = 'LAND_NOW'; reason = `Motor ${i+1} (${WINGS[i].name}) has stopped!`;
      continue;
    }
    if (rpm <= 100) { health[i] = 'IDLE'; continue; }

    const dev = Math.abs(rpm - avg) / avg * 100;
    if (rpm < 3000) { health[i] = 'WARNING'; warnings.push(`⚠️ Motor ${i+1} (${WINGS[i].short}): Low RPM (${rpm})`); if(decision!=='LAND_NOW'){decision='WARNING';reason=`Motor ${i+1} RPM too low`;} }
    else if (rpm > 7000) { health[i] = 'WARNING'; warnings.push(`⚠️ Motor ${i+1} (${WINGS[i].short}): High RPM (${rpm})`); if(decision!=='LAND_NOW'){decision='WARNING';reason=`Motor ${i+1} RPM too high`;} }
    else if (dev > 30) { health[i] = 'CRITICAL'; warnings.push(`🛑 Motor ${i+1} (${WINGS[i].short}): ${dev.toFixed(0)}% off balance!`); decision='LAND_NOW'; reason=`Motor ${i+1} severely imbalanced (${dev.toFixed(0)}%)`; }
    else if (dev > 15) { health[i] = 'WARNING'; warnings.push(`⚠️ Motor ${i+1} (${WINGS[i].short}): ${dev.toFixed(0)}% off balance`); if(decision!=='LAND_NOW'){decision='WARNING';reason=`Motor ${i+1} RPM imbalance (${dev.toFixed(0)}%)`;} }
    else { health[i] = 'GOOD'; }
  }

  let balance = 100;
  if (active.length >= 2) {
    const maxDev = Math.max(...active.map(r => Math.abs(r - avg) / avg * 100));
    balance = Math.max(0, Math.round(100 - maxDev * 2));
  }

  return { decision, reason, health, balance, anomaly: decision !== 'FLY_SAFE' && decision !== 'STANDBY' ? 1 : 0, warnings };
};

// ==========================================
// STYLES
// ==========================================
const S = {
  app:{minHeight:'100vh',background:'linear-gradient(135deg,#080c24 0%,#111633 40%,#0a1628 100%)',fontFamily:"'Segoe UI',Tahoma,sans-serif",color:'#fff',position:'relative'},
  grid:{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundImage:'linear-gradient(rgba(0,217,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,217,255,0.02) 1px,transparent 1px)',backgroundSize:'60px 60px',pointerEvents:'none',zIndex:0},
  header:{background:'linear-gradient(180deg,rgba(8,12,36,0.98),rgba(17,22,51,0.95))',borderBottom:'2px solid rgba(0,217,255,0.25)',padding:'18px 28px',position:'sticky',top:0,zIndex:100,backdropFilter:'blur(20px)'},
  glass:{background:'linear-gradient(145deg,rgba(17,22,51,0.92),rgba(8,12,36,0.96))',backdropFilter:'blur(16px)',borderRadius:20,border:'1px solid rgba(0,217,255,0.12)',padding:24,transition:'all 0.4s'},
  card:{background:'rgba(17,22,51,0.85)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:20,padding:22,textAlign:'center'},
  badge:{fontSize:11,fontWeight:700,padding:'7px 14px',borderRadius:20,display:'inline-block',letterSpacing:1.5},
  title:{fontSize:19,fontWeight:700,color:'#00d9ff',marginBottom:14,display:'flex',alignItems:'center',gap:10},
  div:{height:1,background:'linear-gradient(90deg,transparent,rgba(0,217,255,0.25),transparent)',margin:'14px 0'},
  warn:{display:'flex',alignItems:'center',gap:12,padding:12,background:'rgba(255,171,64,0.08)',border:'1px solid rgba(255,171,64,0.25)',borderRadius:12,color:'#ffab40',marginBottom:8,fontSize:13},
  map:{height:320,borderRadius:16,overflow:'hidden',border:'2px solid rgba(0,217,255,0.25)'},
  footer:{padding:'14px 24px',background:'rgba(0,0,0,0.3)',borderTop:'1px solid rgba(0,217,255,0.15)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13,color:'rgba(255,255,255,0.45)'},
  tab:{display:'flex',alignItems:'center',gap:8,padding:'12px 24px',background:'transparent',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,color:'rgba(255,255,255,0.5)',fontSize:15,fontWeight:600,cursor:'pointer',transition:'all 0.3s'},
  tabA:{background:'linear-gradient(135deg,rgba(0,217,255,0.15),rgba(0,255,136,0.08))',borderColor:'#00d9ff',color:'#00d9ff',boxShadow:'0 0 15px rgba(0,217,255,0.2)'},
  live:{display:'flex',alignItems:'center',gap:8,padding:'7px 15px',borderRadius:20,fontSize:11,fontWeight:700,letterSpacing:2},
};

// ==========================================
// RPM GAUGE
// ==========================================
const RPMGauge = ({ rpm, wing, health }) => {
  const pct = Math.min(100, (rpm / 8000) * 100);
  const isCrit = health === 'CRITICAL', isWarn = health === 'WARNING', isGood = health === 'GOOD', isIdle = health === 'IDLE';
  const c = isCrit ? '#ff5252' : isWarn ? '#ffab40' : isIdle ? 'rgba(255,255,255,0.3)' : wing.color;

  return (
    <div style={{
      background: isCrit ? 'rgba(255,82,82,0.1)' : 'rgba(0,0,0,0.25)',
      borderRadius: 20, padding: 18, textAlign: 'center',
      border: `2px solid ${isCrit ? 'rgba(255,82,82,0.5)' : isWarn ? 'rgba(255,171,64,0.4)' : 'rgba(255,255,255,0.06)'}`,
      boxShadow: isCrit ? '0 0 35px rgba(255,82,82,0.5)' : isWarn ? '0 0 25px rgba(255,171,64,0.4)' : isGood ? `0 0 20px ${wing.color}40` : 'none',
      transition: 'all 0.4s',
    }}>
      <p style={{margin:'0 0 2px',fontSize:9,color:'rgba(255,255,255,0.35)',letterSpacing:2.5}}>IR{wing.id} • GPIO{wing.gpio}</p>
      <p style={{margin:'0 0 10px',fontSize:13,fontWeight:700,color:c}}>{wing.name}</p>
      <div style={{position:'relative',width:110,height:110,margin:'0 auto'}}>
        <svg width="110" height="110" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeDasharray="216" transform="rotate(-225 55 55)" strokeLinecap="round"/>
          <circle cx="55" cy="55" r="46" fill="none" stroke={c} strokeWidth="8" strokeDasharray="216" strokeDashoffset={216-(216*0.75*pct/100)} transform="rotate(-225 55 55)" strokeLinecap="round" style={{transition:'stroke-dashoffset 0.6s',filter:`drop-shadow(0 0 5px ${c})`}}/>
        </svg>
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
          <p style={{margin:0,fontSize:22,fontWeight:900,color:c,lineHeight:1}}>{rpm}</p>
          <p style={{margin:'2px 0 0',fontSize:9,color:'rgba(255,255,255,0.4)'}}>RPM</p>
        </div>
      </div>
      <div style={{marginTop:10}}>
        <span style={{...S.badge,fontSize:10,background:`${c}18`,color:c,border:`1px solid ${c}50`}}>
          {isCrit?'🛑 CRITICAL':isWarn?'⚠️ UNSTABLE':isGood?'✅ STABLE':'⏸ IDLE'}
        </span>
      </div>
    </div>
  );
};

// ==========================================
// DECISION PANEL
// ==========================================
const DecisionPanel = ({ decision, reason, balance, warnings, eventLog, totalWarn, totalCrit, perWing }) => {
  const ds = {
    FLY_SAFE:{bg:'linear-gradient(135deg,rgba(0,230,118,0.15),rgba(0,200,83,0.08))',border:'#00e676',icon:'✅',label:'FLY SAFE',color:'#00e676'},
    WARNING:{bg:'linear-gradient(135deg,rgba(255,171,64,0.15),rgba(255,152,0,0.08))',border:'#ffab40',icon:'⚠️',label:'CAUTION',color:'#ffab40'},
    LAND_NOW:{bg:'linear-gradient(135deg,rgba(255,82,82,0.2),rgba(211,47,47,0.1))',border:'#ff5252',icon:'🛑',label:'LAND NOW',color:'#ff5252'},
    STANDBY:{bg:'linear-gradient(135deg,rgba(100,100,100,0.1),rgba(80,80,80,0.05))',border:'#888',icon:'⏸️',label:'STANDBY',color:'#888'},
  }[decision] || {bg:'',border:'#888',icon:'⏸️',label:'STANDBY',color:'#888'};

  return (
    <div style={S.glass}>
      <h2 style={S.title}><FaBrain style={{color:'#ce93d8'}}/> AI Decision Engine</h2>
      <div style={S.div}/>
      <div style={{background:ds.bg,border:`2px solid ${ds.border}50`,borderRadius:20,padding:24,textAlign:'center',marginBottom:16,boxShadow:decision==='LAND_NOW'?`0 0 30px ${ds.border}30`:'none'}}>
        <span style={{fontSize:48}}>{ds.icon}</span>
        <p style={{margin:'8px 0 4px',fontSize:28,fontWeight:900,color:ds.color,letterSpacing:3}}>{ds.label}</p>
        <p style={{margin:0,fontSize:13,color:'rgba(255,255,255,0.6)'}}>{reason}</p>
      </div>

      <div style={{background:'rgba(0,0,0,0.2)',borderRadius:14,padding:16,marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <span style={{fontSize:13,color:'rgba(255,255,255,0.6)'}}>RPM Balance Score</span>
          <span style={{fontSize:20,fontWeight:800,color:balance>80?'#00e676':balance>50?'#ffab40':'#ff5252'}}>{balance}%</span>
        </div>
        <div style={{height:8,borderRadius:4,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
          <div style={{height:'100%',borderRadius:4,width:`${balance}%`,background:balance>80?'linear-gradient(90deg,#00e676,#00c853)':balance>50?'linear-gradient(90deg,#ffab40,#ff9800)':'linear-gradient(90deg,#ff5252,#d32f2f)',transition:'width 0.5s'}}/>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
        <div style={{background:'rgba(255,171,64,0.08)',borderRadius:12,padding:12,textAlign:'center'}}>
          <p style={{margin:0,fontSize:10,color:'rgba(255,255,255,0.4)',letterSpacing:2}}>WARNINGS</p>
          <p style={{margin:0,fontSize:28,fontWeight:900,color:'#ffab40'}}>{totalWarn}</p>
        </div>
        <div style={{background:'rgba(255,82,82,0.08)',borderRadius:12,padding:12,textAlign:'center'}}>
          <p style={{margin:0,fontSize:10,color:'rgba(255,255,255,0.4)',letterSpacing:2}}>CRITICAL</p>
          <p style={{margin:0,fontSize:28,fontWeight:900,color:'#ff5252'}}>{totalCrit}</p>
        </div>
      </div>

      {perWing && <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:16}}>
        {perWing.map((c,i)=>(<div key={i} style={{background:'rgba(0,0,0,0.15)',borderRadius:8,padding:6,textAlign:'center'}}><p style={{margin:0,fontSize:9,color:'rgba(255,255,255,0.35)'}}>{WINGS[i].short}</p><p style={{margin:0,fontSize:16,fontWeight:700,color:c>0?'#ff8a80':WINGS[i].color}}>{c}</p></div>))}
      </div>}

      {warnings && warnings.length > 0 && <div>
        <p style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:8,letterSpacing:1}}>ACTIVE WARNINGS</p>
        {warnings.map((w,i)=><div key={i} style={S.warn}><FaExclamationTriangle style={{flexShrink:0}}/><span>{w}</span></div>)}
      </div>}

      <p style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:12,marginBottom:8,letterSpacing:1}}>EVENT LOG</p>
      <div style={{maxHeight:160,overflowY:'auto'}}>
        {eventLog && eventLog.length > 0 ? [...eventLog].reverse().slice(0,15).map((e,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',marginBottom:3,background:e.severity==='CRITICAL'?'rgba(255,82,82,0.06)':'rgba(255,171,64,0.05)',border:`1px solid ${e.severity==='CRITICAL'?'rgba(255,82,82,0.15)':'rgba(255,171,64,0.12)'}`,borderRadius:8,fontSize:11}}>
            <span style={{color:e.severity==='CRITICAL'?'#ff5252':'#ffab40',fontWeight:700,fontSize:10}}>{e.severity==='CRITICAL'?'🛑':'⚠️'}</span>
            <span style={{color:'rgba(255,255,255,0.35)'}}>{e.time}</span>
            <span style={{color:WINGS[(e.motor||1)-1]?.color,fontWeight:600}}>M{e.motor}</span>
            <span style={{color:'rgba(255,255,255,0.5)',marginLeft:'auto'}}>{e.message}</span>
          </div>
        )) : <div style={{textAlign:'center',padding:16,color:'rgba(255,255,255,0.25)',fontSize:12}}>No events — all motors stable</div>}
      </div>
    </div>
  );
};

// ==========================================
// APP
// ==========================================
function App() {
  const [tab, setTab] = useState(0);
  const [d, setD] = useState({
    rpms:[0,0,0,0], rpmHealth:['IDLE','IDLE','IDLE','IDLE'],
    balance:100, decision:'STANDBY', reason:'Initializing...', anomaly:0, warnings:[],
    lat:ROUTE.wps[0][0], lng:ROUTE.wps[0][1], alt:0, speed:0, sats:0,
    roll:0, pitch:0, yaw:0,
    battery:92, voltage:12.4, current:8.5, temp:34, vib:15, wind:4,
    armed:true, mode:'AUTO',
  });
  const [rpmHistory, setRpmHistory] = useState([]);
  const [battHistory, setBattHistory] = useState([]);
  const [flightPath, setFlightPath] = useState([]);
  const [eventLog, setEventLog] = useState([]);
  const [totalWarn, setTotalWarn] = useState(0);
  const [totalCrit, setTotalCrit] = useState(0);
  const [perWing, setPerWing] = useState([0,0,0,0]);
  const [wpIdx, setWpIdx] = useState(0);
  const [dir, setDir] = useState(1);

  // ══════════════════════════════════
  //  BUILT-IN DEMO SIMULATION
  // ══════════════════════════════════
  useEffect(() => {
    const baseRPM = 5200;
    let batt = 92;
    let wi = 0, d = 1;
    let tw = 0, tc = 0;
    const pw = [0,0,0,0];
    const log = [];

    const interval = setInterval(() => {
      // Move along route
      wi += d;
      if (wi >= ROUTE.wps.length) { wi = ROUTE.wps.length - 2; d = -1; }
      else if (wi < 0) { wi = 1; d = 1; }

      const wp = ROUTE.wps[wi];
      batt = Math.max(15, batt - Math.random() * 0.06);

      // Simulate RPMs
      let rpms = [
        Math.round(baseRPM + (Math.random() - 0.5) * 200),
        Math.round(baseRPM + (Math.random() - 0.5) * 200),
        Math.round(baseRPM + (Math.random() - 0.5) * 200),
        Math.round(baseRPM + (Math.random() - 0.5) * 200),
      ];

      // Occasionally create issues
      const r = Math.random();
      if (r > 0.97) {
        const bad = Math.floor(Math.random() * 4);
        rpms[bad] = Math.round(rpms[bad] * (Math.random() * 0.3 + 0.05));
        tc++;
        pw[bad]++;
        log.push({ time: new Date().toLocaleTimeString().slice(0,8), motor: bad+1, severity: 'CRITICAL', message: `RPM dropped to ${rpms[bad]}`, rpm: rpms[bad] });
      } else if (r > 0.92) {
        const bad = Math.floor(Math.random() * 4);
        rpms[bad] = Math.round(rpms[bad] * (Math.random() * 0.15 + 0.7));
        tw++;
        pw[bad]++;
        log.push({ time: new Date().toLocaleTimeString().slice(0,8), motor: bad+1, severity: 'WARNING', message: `RPM unstable (${rpms[bad]})`, rpm: rpms[bad] });
      }

      // Analyze
      const analysis = analyzeRPMs(rpms);

      const ts = new Date().toLocaleTimeString().slice(0,8);

      setD({
        rpms, rpmHealth: analysis.health,
        balance: analysis.balance, decision: analysis.decision,
        reason: analysis.reason, anomaly: analysis.anomaly, warnings: analysis.warnings,
        lat: wp[0] + (Math.random()-0.5)*0.00004,
        lng: wp[1] + (Math.random()-0.5)*0.00004,
        alt: Math.round(45 + Math.random()*15),
        speed: Math.round((6+Math.random()*6)*10)/10,
        sats: Math.floor(10 + Math.random()*6),
        roll: Math.round((Math.random()-0.5)*10*10)/10,
        pitch: Math.round((Math.random()-0.5)*8*10)/10,
        yaw: Math.round((Math.random()-0.5)*360*10)/10,
        battery: Math.round(batt*10)/10,
        voltage: Math.round((10.5+batt*0.02)*100)/100,
        current: Math.round((8+Math.random()*5)*100)/100,
        temp: Math.round((32+Math.random()*8)*10)/10,
        vib: Math.round((10+Math.random()*20)*10)/10,
        wind: Math.round((2+Math.random()*6)*10)/10,
        armed: true, mode: 'AUTO',
      });

      setRpmHistory(prev => [...prev.slice(-100), { time: ts, m1:rpms[0], m2:rpms[1], m3:rpms[2], m4:rpms[3] }]);
      setBattHistory(prev => [...prev.slice(-50), { time: ts.slice(0,5), value: Math.round(batt*10)/10 }]);
      setFlightPath(prev => [...prev.slice(-300), wp]);
      setEventLog(log.slice(-50));
      setTotalWarn(tw);
      setTotalCrit(tc);
      setPerWing([...pw]);
      setWpIdx(wi);
      setDir(d);

    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const overallHealth = Math.round(
    Math.min(100,Math.max(0,d.battery))*0.25 +
    d.balance*0.35 +
    Math.min(100,d.sats*7)*0.15 +
    Math.max(0,100-d.vib)*0.25
  );

  const healthData = [
    {subject:'RPM Balance',value:d.balance},
    {subject:'Battery',value:Math.round(d.battery)},
    {subject:'GPS',value:d.sats>8?98:50},
    {subject:'Vibration',value:Math.max(0,100-d.vib)},
    {subject:'Attitude',value:Math.max(0,100-Math.abs(d.roll)-Math.abs(d.pitch))},
  ];

  return (
    <div style={S.app}>
      <div style={S.grid}/>
      <style>{`@keyframes pulse{0%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}`}</style>

      <header style={S.header}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:54,height:54,background:'linear-gradient(135deg,#00d9ff,#00ff88)',borderRadius:14,display:'flex',justifyContent:'center',alignItems:'center',boxShadow:'0 0 25px rgba(0,217,255,0.4)'}}>
              <FaPlane style={{fontSize:26,color:'#080c24'}}/>
            </div>
            <div>
              <h1 style={{fontSize:24,fontWeight:800,background:'linear-gradient(90deg,#00d9ff,#00ff88)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',letterSpacing:2,margin:0}}>UAV DIGITAL TWIN</h1>
              <p style={{fontSize:11,color:'rgba(255,255,255,0.4)',letterSpacing:3,textTransform:'uppercase',marginTop:2}}>Actuator Health Monitoring Using Real-Time ML</p>
            </div>
          </div>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <div style={{...S.live,background:'rgba(0,230,118,0.12)',color:'#00e676',border:'1px solid #00e67640',fontSize:12,padding:'8px 16px'}}>
              <Pulse color="#00e676"/> ● SIMULATION ACTIVE
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 20px',borderRadius:50,background:'rgba(0,0,0,0.25)',border:'1px solid rgba(0,230,118,0.4)'}}>
              <div style={{width:10,height:10,borderRadius:'50%',background:'#00e676',boxShadow:'0 0 8px #00e676'}}/>
              <span style={{fontWeight:600,letterSpacing:2,fontSize:12,color:'#00e676'}}>ARMED</span>
            </div>
          </div>
        </div>
        <nav style={{display:'flex',gap:8}}>
          {[{id:0,l:'RPM Monitor',i:<FaHome/>},{id:1,l:'Flight Data',i:<FaMapMarkerAlt/>},{id:2,l:'Battery',i:<FaBatteryThreeQuarters/>}].map(t=>
            <button key={t.id} style={{...S.tab,...(tab===t.id?S.tabA:{})}} onClick={()=>setTab(t.id)}>{t.i} {t.l}</button>
          )}
        </nav>
      </header>

      <main style={{padding:22,position:'relative',zIndex:1}}>
        {/* ═══ RPM MONITOR TAB ═══ */}
        {tab===0 && <div>
          <div style={{...S.glass,background:'linear-gradient(135deg,rgba(0,217,255,0.08),rgba(0,255,136,0.04))',border:'1px solid rgba(0,217,255,0.2)',padding:32,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <h1 style={{fontSize:32,fontWeight:800,background:'linear-gradient(90deg,#00d9ff,#00ff88)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',margin:0}}>🚁 Wing RPM Health Monitor</h1>
              <p style={{fontSize:15,color:'rgba(255,255,255,0.5)',marginTop:6}}>Real-time actuator speed analysis • AI-driven fly/land decisions • UET Taxila FYP</p>
              <div style={{display:'flex',gap:10,marginTop:14,flexWrap:'wrap'}}>
                <span style={{...S.live,background:d.decision==='FLY_SAFE'?'rgba(0,230,118,0.15)':d.decision==='LAND_NOW'?'rgba(255,82,82,0.15)':'rgba(255,171,64,0.15)',color:d.decision==='FLY_SAFE'?'#00e676':d.decision==='LAND_NOW'?'#ff5252':'#ffab40',border:`1px solid ${d.decision==='FLY_SAFE'?'#00e67640':d.decision==='LAND_NOW'?'#ff525240':'#ffab4040'}`}}>
                  {d.decision==='FLY_SAFE'?'✅':d.decision==='LAND_NOW'?'🛑':'⚠️'} {d.decision}
                </span>
                <span style={{...S.badge,background:'rgba(0,217,255,0.12)',color:'#00d9ff',border:'1px solid #00d9ff30'}}><FaSatellite style={{marginRight:5}}/> {d.sats} Sats</span>
                <span style={{...S.badge,background:'rgba(156,39,176,0.12)',color:'#ce93d8',border:'1px solid #ce93d830'}}>Health: {overallHealth}%</span>
              </div>
            </div>
            <div style={{fontSize:80,opacity:0.15}}>🚁</div>
          </div>

          {/* Status Cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginTop:20}}>
            {[
              {t:'Decision',v:d.decision,c:d.decision==='FLY_SAFE'?'#00e676':d.decision==='LAND_NOW'?'#ff5252':'#ffab40',icon:d.decision==='FLY_SAFE'?<FaCheckCircle color="white"/>:<FaExclamationTriangle color="white"/>,g:d.decision==='FLY_SAFE'?'linear-gradient(135deg,#00e676,#00c853)':d.decision==='LAND_NOW'?'linear-gradient(135deg,#ff5252,#d32f2f)':'linear-gradient(135deg,#ffab40,#ff9800)'},
              {t:'Balance',v:`${d.balance}%`,c:d.balance>80?'#00e676':d.balance>50?'#ffab40':'#ff5252',icon:<FaShieldAlt color="white"/>,g:`linear-gradient(135deg,${d.balance>80?'#00e676':'#ffab40'},${d.balance>80?'#00c853':'#ff9800'})`},
              {t:'Health',v:`${overallHealth}%`,c:'#ce93d8',icon:<FaBrain color="white"/>,g:'linear-gradient(135deg,#9c27b0,#673ab7)'},
              {t:'Mode',v:d.mode,c:'#00d9ff',icon:<FaPlane color="white"/>,g:'linear-gradient(135deg,#0088cc,#005577)'},
              {t:'Battery',v:`${Math.round(d.battery)}%`,c:d.battery>50?'#00e676':d.battery>25?'#ffab40':'#ff5252',icon:<FaBatteryThreeQuarters color="white"/>,g:`linear-gradient(135deg,${d.battery>50?'#00e676':'#ffab40'},${d.battery>50?'#00c853':'#ff9800'})`},
              {t:'Events',v:String(totalWarn+totalCrit),c:totalCrit>0?'#ff5252':totalWarn>0?'#ffab40':'#00e676',icon:<FaExclamationTriangle color="white"/>,g:`linear-gradient(135deg,${totalCrit>0?'#ff5252':'#00e676'},${totalCrit>0?'#d32f2f':'#00c853'})`},
            ].map((x,i)=>(
              <div key={i} style={S.card}>
                <div style={{width:56,height:56,borderRadius:'50%',background:x.g,display:'flex',justifyContent:'center',alignItems:'center',margin:'0 auto 12px',fontSize:26,boxShadow:`0 0 20px ${x.c}40`}}>{x.icon}</div>
                <p style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.7)',margin:'0 0 8px'}}>{x.t}</p>
                <span style={{...S.badge,background:`${x.c}18`,color:x.c,border:`1px solid ${x.c}35`,fontSize:13}}>{x.v}</span>
              </div>
            ))}
          </div>

          {/* Drone RPM Layout + Decision Panel */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginTop:20}}>
            <div style={S.glass}>
              <h2 style={{...S.title,justifyContent:'center'}}>🚁 4-Wing RPM <span style={{marginLeft:10,fontSize:11,color:'#00e676',display:'flex',alignItems:'center',gap:5}}><Pulse color="#00e676"/> LIVE</span></h2>
              <div style={S.div}/>
              <div style={{maxWidth:520,margin:'0 auto'}}>
                <p style={{textAlign:'center',fontSize:11,color:'rgba(255,255,255,0.25)',letterSpacing:4,marginBottom:6}}>▲ FRONT</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  <RPMGauge rpm={d.rpms[2]} wing={WINGS[2]} health={d.rpmHealth[2]}/>
                  <RPMGauge rpm={d.rpms[0]} wing={WINGS[0]} health={d.rpmHealth[0]}/>
                </div>
                <div style={{textAlign:'center',padding:12,margin:'10px auto',background:'rgba(0,217,255,0.04)',border:'1px solid rgba(0,217,255,0.15)',borderRadius:14,maxWidth:180}}>
                  <span style={{fontSize:26}}>🚁</span>
                  <p style={{margin:'2px 0 0',fontSize:11,color:d.balance>80?'#00e676':d.balance>50?'#ffab40':'#ff5252'}}>
                    {d.balance>80?'✅ Balanced':d.balance>50?'⚠️ Unstable':'🛑 Imbalanced'}
                  </p>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  <RPMGauge rpm={d.rpms[1]} wing={WINGS[1]} health={d.rpmHealth[1]}/>
                  <RPMGauge rpm={d.rpms[3]} wing={WINGS[3]} health={d.rpmHealth[3]}/>
                </div>
                <p style={{textAlign:'center',fontSize:11,color:'rgba(255,255,255,0.25)',letterSpacing:4,marginTop:6}}>▼ REAR</p>
              </div>
            </div>
            <DecisionPanel decision={d.decision} reason={d.reason} balance={d.balance} warnings={d.warnings} eventLog={eventLog} totalWarn={totalWarn} totalCrit={totalCrit} perWing={perWing}/>
          </div>

          {/* RPM History + Health Radar */}
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:20,marginTop:20}}>
            <div style={S.glass}>
              <h2 style={S.title}>📊 RPM History (All Wings)</h2>
              <div style={S.div}/>
              <div style={{width:'100%',height:260}}>
                <ResponsiveContainer>
                  <LineChart data={rpmHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
                    <XAxis dataKey="time" stroke="#fff" tick={{fontSize:9}}/>
                    <YAxis stroke="#fff" tick={{fontSize:9}}/>
                    <Tooltip contentStyle={{backgroundColor:'#111633',border:'1px solid #00d9ff40',borderRadius:10,fontSize:12}}/>
                    <Line type="monotone" dataKey="m1" name={`M1 ${WINGS[0].short}`} stroke={WINGS[0].color} strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="m2" name={`M2 ${WINGS[1].short}`} stroke={WINGS[1].color} strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="m3" name={`M3 ${WINGS[2].short}`} stroke={WINGS[2].color} strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="m4" name={`M4 ${WINGS[3].short}`} stroke={WINGS[3].color} strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:20,marginTop:10}}>
                {WINGS.map((w,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:5,fontSize:11}}><div style={{width:14,height:3,background:w.color,borderRadius:2}}/><span style={{color:'rgba(255,255,255,0.45)'}}>{w.short} ({d.rpms[i]})</span></div>)}
              </div>
            </div>
            <div style={S.glass}>
              <h2 style={S.title}><FaHeartbeat style={{color:'#ff6b9d'}}/> System Health</h2>
              <div style={S.div}/>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={healthData}>
                  <PolarGrid stroke="rgba(255,255,255,0.12)"/>
                  <PolarAngleAxis dataKey="subject" tick={{fill:'#fff',fontSize:10}}/>
                  <PolarRadiusAxis angle={30} domain={[0,100]} tick={{fill:'#fff',fontSize:8}}/>
                  <Radar name="Health" dataKey="value" stroke="#00d9ff" fill="#00d9ff" fillOpacity={0.35}/>
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>}

        {/* ═══ FLIGHT DATA TAB ═══ */}
        {tab===1 && <div>
          <div style={S.glass}>
            <h2 style={S.title}><FaMapMarkerAlt style={{color:'#00d9ff'}}/> Live UAV Location — UET Taxila Campus</h2>
            <div style={S.div}/>
            <div style={S.map}>
              <MapContainer center={[33.684,73.0]} zoom={17} style={{height:'100%',width:'100%'}} zoomControl>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap"/>
                <Polyline positions={ROUTE.wps} color="#00d9ff" weight={4} opacity={0.4} dashArray="10,10"/>
                {flightPath.length>1&&<Polyline positions={flightPath} color="#00ff88" weight={3} opacity={0.8}/>}
                <Marker position={[ROUTE.start.lat,ROUTE.start.lng]} icon={startIcon}><Popup><div style={{color:'#333',fontWeight:'bold'}}>📡 Telecom Engineering Dept</div></Popup></Marker>
                <Marker position={[ROUTE.end.lat,ROUTE.end.lng]} icon={endIcon}><Popup><div style={{color:'#333',fontWeight:'bold'}}>🏛️ Admin Block UET Taxila</div></Popup></Marker>
                <Marker position={[d.lat,d.lng]} icon={uavIcon}><Popup><div style={{color:'#333',fontWeight:'bold'}}>🚁 UAV Position<br/>Alt: {d.alt}m | Speed: {d.speed}m/s<br/>GPS: {d.sats} satellites</div></Popup></Marker>
                <Circle center={[d.lat,d.lng]} radius={30} pathOptions={{color:'#00d9ff',fillColor:'#00d9ff',fillOpacity:0.12}}/>
                <MapUp c={[d.lat,d.lng]}/>
              </MapContainer>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:14,marginTop:20}}>
            {[
              {l:'Altitude',v:`${d.alt}m`,c:'#ffab40',i:<FaPlane/>},
              {l:'Speed',v:`${d.speed}m/s`,c:'#ff6b9d',i:<MdSpeed/>},
              {l:'GPS Sats',v:d.sats,c:'#00e676',i:<MdGpsFixed/>},
              {l:'Heading',v:`${d.yaw}°`,c:'#00d9ff',i:<FaCogs/>},
              {l:'Roll',v:`${d.roll}°`,c:'#ce93d8',i:<FaShieldAlt/>},
              {l:'Pitch',v:`${d.pitch}°`,c:'#ff6b9d',i:<FaShieldAlt/>},
              {l:'Wind',v:`${d.wind}km/h`,c:'#00d9ff',i:<FaWind/>},
              {l:'Vibration',v:`${d.vib}%`,c:d.vib<50?'#00e676':'#ffab40',i:<FaHeartbeat/>},
            ].map((x,i)=>(
              <div key={i} style={S.card}>
                <div style={{width:40,height:40,borderRadius:'50%',background:`${x.c}25`,color:x.c,display:'flex',justifyContent:'center',alignItems:'center',margin:'0 auto 8px',fontSize:18}}>{x.i}</div>
                <p style={{fontSize:11,color:'rgba(255,255,255,0.5)',margin:0}}>{x.l}</p>
                <p style={{fontSize:20,fontWeight:700,color:x.c,margin:'4px 0 0'}}>{x.v}</p>
              </div>
            ))}
          </div>
        </div>}

        {/* ═══ BATTERY TAB ═══ */}
        {tab===2 && <div>
          <div style={{...S.glass,textAlign:'center',marginBottom:20}}>
            <h1 style={{fontSize:26,fontWeight:800,background:'linear-gradient(90deg,#00d9ff,#00ff88)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',margin:0}}>🔋 Intelligent Battery Management</h1>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
            {[
              {l:'Battery',v:`${Math.round(d.battery)}%`,c:d.battery>60?'#00e676':d.battery>30?'#ffab40':'#ff5252',i:<FaBatteryThreeQuarters/>},
              {l:'Voltage',v:`${d.voltage}V`,c:'#00d9ff',i:<FaBolt/>},
              {l:'Current',v:`${d.current}A`,c:'#ff6b9d',i:<FaTachometerAlt/>},
              {l:'Temperature',v:`${d.temp}°C`,c:'#ffab40',i:<FaThermometerHalf/>},
            ].map((x,i)=>(
              <div key={i} style={S.card}>
                <div style={{width:46,height:46,borderRadius:'50%',background:`${x.c}25`,color:x.c,display:'flex',justifyContent:'center',alignItems:'center',margin:'0 auto 10px',fontSize:20}}>{x.i}</div>
                <p style={{fontSize:12,color:'rgba(255,255,255,0.5)',margin:0}}>{x.l}</p>
                <p style={{fontSize:26,fontWeight:800,color:x.c,margin:'6px 0 0'}}>{x.v}</p>
              </div>
            ))}
          </div>
          <div style={{...S.glass,marginTop:20}}>
            <h2 style={S.title}>📈 Battery Discharge History</h2><div style={S.div}/>
            <div style={{width:'100%',height:240}}>
              <ResponsiveContainer>
                <AreaChart data={battHistory}>
                  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00d9ff" stopOpacity={0.5}/><stop offset="95%" stopColor="#00d9ff" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
                  <XAxis dataKey="time" stroke="#fff" tick={{fontSize:9}}/><YAxis domain={[0,100]} stroke="#fff"/>
                  <Tooltip contentStyle={{backgroundColor:'#111633',border:'1px solid #00d9ff40',borderRadius:10}}/>
                  <Area type="monotone" dataKey="value" stroke="#00d9ff" fill="url(#bg)" strokeWidth={3}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>}
      </main>

      <footer style={S.footer}>
        <span>© 2024 UAV Digital Twin — FYP Project | UET Taxila Campus Surveillance</span>
        <div style={{display:'flex',gap:16}}>
          <span>Decision: <strong style={{color:d.decision==='FLY_SAFE'?'#00e676':d.decision==='LAND_NOW'?'#ff5252':'#ffab40'}}>{d.decision}</strong></span>
          <span>Balance: {d.balance}%</span>
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;