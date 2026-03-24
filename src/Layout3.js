import React, { useState, useEffect } from 'react';
import {
  Box, CssBaseline, ThemeProvider, createTheme,
  Grid, Paper, Typography, AppBar, Toolbar,
  IconButton, Snackbar, Alert, CircularProgress,
  Drawer, List, ListItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent
} from '@mui/material';
import {
  Map as MapIcon, Speed as SpeedIcon,
  BatteryChargingFull as BatteryIcon,
  Menu as MenuIcon, Flight as FlightIcon
} from '@mui/icons-material';
import SensorsIcon from '@mui/icons-material/Sensors';
import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import { styled } from '@mui/system';

import {
  ResponsiveContainer, LineChart, Line, CartesianGrid,
  XAxis, YAxis, Tooltip as RechartsTooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts';

import {
  MapContainer, TileLayer, Marker, Popup
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Replace with your actual backend and websocket URLs
const BACKEND_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';
// Theme
const uavTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2A8A8C' },
    secondary: { main: '#FF7E00' },
    background: { default: '#1B5E60', paper: '#333333' },
    text: { primary: '#FFFFFF', secondary: '#CCCCCC' }
  },
  typography: {
    fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
    h6: { fontWeight: 500, letterSpacing: '0.02em' },
    subtitle2: { fontWeight: 500, letterSpacing: '0.02em' }
  },
  components: {
    MuiPaper: {
      styleOverrides: { root: { borderRadius: 4, boxShadow: '0px 3px 5px rgba(0,0,0,0.2)' } }
    },
    MuiAppBar: {
      styleOverrides: { root: { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' } }
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 4 } }
    }
  }
});

// Styled
const WidgetCard = styled(Paper)({
  height: '100%', display: 'flex', flexDirection: 'column',
  overflow: 'hidden', borderRadius: 4, backgroundColor: '#333333'
});
const WidgetHeader = styled(Box)({
  padding: 12, display: 'flex', alignItems: 'center',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  backgroundColor: '#2A8A8C', color: '#FFFFFF'
});
const WidgetContent = styled(Box)({
  padding: 16, flexGrow: 1, overflow: 'auto',
  display: 'flex', flexDirection: 'column',
  backgroundColor: '#333333', color: '#FFFFFF'
});
// Circular progress with label
const CircularProgressWithLabel = ({ value, label, max, color }) => (
  <Box sx={{
    position: 'relative', display: 'inline-flex',
    flexDirection: 'column', alignItems: 'center',
    p: 1, borderRadius: '8px'
  }}>
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        value={(value / max) * 100}
        size={100}
        thickness={4}
        sx={{ color: color === 'success' ? '#4caf50' : color === 'warning' ? '#ff9800' : '#f44336' }}
      />
      <Box sx={{
        position: 'absolute', top: 0, left: 0, bottom: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Typography variant="h5" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
          {value}
        </Typography>
      </Box>
    </Box>
    <Typography variant="subtitle1" sx={{ mt: 1, color: '#CCCCCC' }}>
      {label}
    </Typography>
  </Box>
);

// Semi-circular gauge
const GaugeComponent = ({ value, min, max, title }) => {
  const angle = 180 * (value - min) / (max - min);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
      <Box sx={{ position: 'relative', width: '100%', maxWidth: '200px', height: '120px', mb: 1 }}>
        <svg width="100%" height="100%" viewBox="0 0 200 120">
          <path d="M20 100 A80 80 0 0 1 80 30" fill="none" stroke="#f44336" strokeWidth={14}/>
          <path d="M80 30 A80 80 0 0 1 120 30" fill="none" stroke="#ff9800" strokeWidth={14}/>
          <path d="M120 30 A80 80 0 0 1 180 100" fill="none" stroke="#4caf50" strokeWidth={14}/>
          <line
            x1="100" y1="100"
            x2={100 - 60 * Math.cos((Math.PI * angle)/180)}
            y2={100 - 60 * Math.sin((Math.PI * angle)/180)}
            stroke="#2A8A8C" strokeWidth={3}
          />
          <circle cx="100" cy="100" r={5} fill="#FFFFFF"/>
          <text x="20" y="115" fontSize={12} fill="#CCCCCC" textAnchor="middle">{min}</text>
          <text x="100" y="115" fontSize={12} fill="#CCCCCC" textAnchor="middle">
            {Math.round((min + max)/2)}
          </text>
          <text x="180" y="115" fontSize={12} fill="#CCCCCC" textAnchor="middle">{max}</text>
        </svg>
        <Typography variant="h5" sx={{
          position: 'absolute', bottom: 30, left: '50%',
          transform: 'translateX(-50%)', color: '#FFFFFF', fontWeight: 'bold'
        }}>
          {value.toFixed(1)}
        </Typography>
      </Box>
      <Typography variant="body2" color="textSecondary">{title}</Typography>
    </Box>
  );
};

// Sidebar items
const parameters = [
  { key: 'sensor1', label: 'Humidity', icon: <SensorsIcon/> },
  { key: 'temperature_press', label: 'Temeprature (C°)', icon: <SensorsIcon/> },
  { key: 'servo1', label: 'Motors', icon: <SettingsRemoteIcon/> },
  { key: 'servo2', label: 'Actuator', icon: <SettingsRemoteIcon/> },
  { key: 'temperature_press', label: 'ESC (C°)', icon: <FlashOnIcon/> },
  { key: 'battery', label: 'Battery (%)', icon: <BatteryIcon/> },
  { key: 'altitude', label: 'Altitude (m)', icon: <SpeedIcon/> },
  { key: 'speed', label: 'Speed', icon: <SpeedIcon/> }
];
function App() {
  const [telemetryData, setTelemetryData] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [batteryHistoryGraph, setBatteryHistoryGraph] = useState([]);
  const [sensorHistory, setSensorHistory] = useState([]);
  const [actuatorHistory, setActuatorHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [mapPosition, setMapPosition] = useState([33.6844, 73.0479]);
  const [latestWarning, setLatestWarning] = useState(null);
  const [warningOpen, setWarningOpen] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogParam, setDialogParam] = useState(null);
  const [dialogHistory, setDialogHistory] = useState([]);

  const toggleDrawer = () => setDrawerOpen(o => !o);
  const openDialog = key => { setDialogParam(key); setDialogOpen(true); setDrawerOpen(false); };
  const closeDialog = () => setDialogOpen(false);
  useEffect(() => {
    if (!dialogParam) return;
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/history/${dialogParam}`);
        setDialogHistory(await res.json());
      } catch { console.error('Dialog history error'); }
    })();
  }, [dialogParam]);

  useEffect(() => {
    const fetchHist = async (param, setter) => {
      try {
        const res = await fetch(`${BACKEND_URL}/history/${param}`);
        setter(await res.json());
      } catch {}
    };
    fetchHist('battery', setBatteryHistoryGraph);
    fetchHist('voltage', setSensorHistory);
    fetchHist('current', setActuatorHistory);
  }, []);

  useEffect(() => {
    let socket, retry;
    const connect = () => {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => setIsConnected(true);
      socket.onclose = () => { setIsConnected(false); retry = setTimeout(connect, 5000); };
      socket.onmessage = e => {
        try {
          const d = JSON.parse(e.data);
          setTelemetryData(d);
          setMapPosition([d.latitude, d.longitude]);
          if (d.warnings?.length) {
            setLatestWarning(d.warnings.slice(-1)[0]);
            setWarningOpen(true);
          }
        } catch {}
      };
    };
    connect();
    const healthInt = setInterval(async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/health`);
        setHealthData(await r.json());
      } catch {}
    }, 5000);
    return () => {
      if (socket) socket.close();
      if (retry) clearTimeout(retry);
      clearInterval(healthInt);
    };
  }, []);const renderDialogChart = () => (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={dialogHistory}>
        <CartesianGrid strokeDasharray="3 3" stroke="#555555"/>
        <XAxis dataKey="time" tick={{ fill:'#CCCCCC' }}/>
        <YAxis tick={{ fill:'#CCCCCC' }}/>
        <RechartsTooltip contentStyle={{ backgroundColor:'#333333', color:'#FFFFFF' }}/>
        <Legend wrapperStyle={{ color:'#CCCCCC' }}/>
        <Line type="monotone" dataKey="value" stroke="#2A8A8C" strokeWidth={2} dot={{ r:3 }}/>
      </LineChart>
    </ResponsiveContainer>
  );

  const renderHealthPanel = () => (
    <Box sx={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center' }}>
      <Box sx={{ height:'55%', width:'100%', position:'relative', mb:1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={healthData ? [
                { name:'UAV Core', value:healthData.uav_health },
                { name:'Sensor Suite', value:healthData.sensor_health }
              ] : []}
              cx="50%" cy="50%" innerRadius={50} outerRadius={60}
              dataKey="value" paddingAngle={5}
              labelLine={{ stroke:'#888', strokeWidth:1, strokeDasharray:'2 2' }}
              label={({ name, percent }) => `${name}: ${(percent*100).toFixed(0)}%`}
            >
              <Cell fill="#2A8A8C"/><Cell fill="#FF7E00"/>
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <Box sx={{
          position:'absolute', top:'50%', left:'50%',
          transform:'translate(-50%,-50%)', display:'flex',
          flexDirection:'column', alignItems:'center'
        }}>
          <FlightIcon sx={{ fontSize:32, color:'#FFFFFF' }}/>
          <Typography variant="caption" sx={{ color:'#FFFFFF', letterSpacing:'0.05em' }}>
            HEALTH
          </Typography>
        </Box>
      </Box>
      <Typography variant="subtitle2" sx={{
        mb:1, letterSpacing:'0.05em', fontWeight:500, color:'#FFFFFF'
      }}>
        Component Status
      </Typography>
      <Box sx={{ overflowY:'auto', flexGrow:1, width:'100%' }}>
        {healthData?.component_status && (
          <Grid container spacing={1}>
            {Object.entries(healthData.component_status).map(([comp, status]) => (
              <Grid item xs={6} key={comp}>
                <Alert severity={status==='normal'?'success':'warning'} icon={false} sx={{
                  px:1.5, py:0.75, fontSize:'0.75rem', borderRadius:6,
                  backgroundColor: status==='normal'
                    ? 'rgba(76,175,80,0.2)' : 'rgba(255,152,0,0.2)',
                  border:'1px solid',
                  borderColor: status==='normal'
                    ? 'rgba(76,175,80,0.4)' : 'rgba(255,152,0,0.4)'
                }}>
                  <Box sx={{
                    display:'flex', justifyContent:'center', position:'relative',
                    '&::before':{
                      content:'""', position:'absolute', left:-8,
                      top:'50%', transform:'translateY(-50%)',
                      width:4, height:4, borderRadius:'50%',
                      backgroundColor: status==='normal'?'#4caf50':'#ff9800'
                    }
                  }}>
                    <Typography variant="caption" sx={{
                      fontWeight:500, letterSpacing:'0.05em', color:'#FFFFFF'
                    }}>
                      {comp}
                    </Typography>
                  </Box>
                </Alert>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );

  const renderWidgetContent = id => {
    switch(id) {
      case 'map':
        return (
          <MapContainer center={mapPosition} zoom={13} style={{ height:'100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
            <Marker position={mapPosition}>
              <Popup>Lat: {mapPosition[0]}<br/>Lng: {mapPosition[1]}</Popup>
            </Marker>
          </MapContainer>
        );
      case 'altitude':
        return (
          <CircularProgressWithLabel
            value={telemetryData?.altitude||0}
            label="Altitude (m)"
            max={1000}
            color={
              telemetryData?.altitude<300?'error':
              telemetryData?.altitude<700?'warning':'success'
            }
          />
        );
      case 'battery':
        return (
          <CircularProgressWithLabel
            value={telemetryData?.battery||0}
            label="Battery (%)"
            max={100}
            color={
              telemetryData?.battery<30?'error':
              telemetryData?.battery<50?'warning':'success'
            }
          />
        );
      case 'speed':
        return (
          <GaugeComponent
            value={telemetryData?.speed||0}
            min={0} max={150}
            title="Speed (km/h)"
          />
        );
      default:
        return null;
    }
  };
  return (
    <ThemeProvider theme={uavTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        {/* Mobile Drawer */}
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={toggleDrawer}
          sx={{ 
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: 200, backgroundColor: '#263238', color: '#FFF' }
          }}
        >
          <Toolbar />
          <List>
            {parameters.map(p => (
              <ListItem button key={p.key} onClick={() => openDialog(p.key)}>
                <ListItemIcon sx={{ color: '#FFF' }}>{p.icon}</ListItemIcon>
                <ListItemText primary={p.label} />
              </ListItem>
            ))}
          </List>
        </Drawer>

        {/* Permanent Sidebar */}
        <Box
          component="nav"
          sx={{
            width: { xs: 0, md: 150 },
            flexShrink: 0,
            backgroundColor: '#263238',
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            borderRight: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <Box sx={{ height: 48 }} /> {/* Space for toolbar */}
          <List sx={{ py: 5, px: 0.5 }}>
            {parameters.map(p => (
              <ListItem 
                button 
                key={p.key} 
                onClick={() => openDialog(p.key)}
                sx={{
                  flexDirection: 'column',
                  alignItems: 'center',
                  py: 4.5,
                  px: 1,
                  mb: 0.5,
                  borderRadius: 1,
                  '&:hover': { 
                    backgroundColor: 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                <ListItemIcon 
                  sx={{ 
                    color: '#FFF', 
                    minWidth: 'auto', 
                    mb: 1.5,
                    justifyContent: 'center'
                  }}
                >
                  {p.icon}
                </ListItemIcon>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#FFF', 
                    fontSize: '1.1rem',
                    textAlign: 'center'
                  }}
                >
                  {p.label}
                </Typography>
              </ListItem>
            ))}
          </List>
        </Box>

        <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md">
          <DialogTitle>{parameters.find(p=>p.key===dialogParam)?.label} Details</DialogTitle>
          <DialogContent>{renderDialogChart()}</DialogContent>
        </Dialog>

        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <AppBar position="static" sx={{ backgroundColor: '#2A8A8C' }}>
            <Toolbar variant="dense">
              <IconButton 
                edge="start" 
                color="inherit" 
                onClick={toggleDrawer} 
                sx={{ mr: 1, display: { xs: 'flex', md: 'none' } }}
              >
                <MenuIcon />
              </IconButton>
              <FlightIcon sx={{ mr: 1 }} />
              <Typography variant="h6" sx={{ flexGrow: 1 }}>UAV Digital Twin</Typography>
              <Box sx={{
                px: 2, py: 0.5, borderRadius: 8,
                backgroundColor: isConnected ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)'
              }}>
                <Typography color={isConnected ? 'success.main' : 'error.main'}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Typography>
              </Box>
            </Toolbar>
          </AppBar>
          {/* Dashboard Content */}
          <Box sx={{ 
            flexGrow: 1, 
            p: 2, 
            width: '100%', 
            height: 'calc(100vh - 48px)', 
            overflow: 'auto'
          }}>
            <Grid container spacing={2} sx={{ height: '100%' }}>
              
              <Grid item xs={12} md={6} sx={{ height: '50%' }}>
                <WidgetCard>
                  <WidgetHeader>
                    <MapIcon sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">Map View</Typography>
                  </WidgetHeader>
                  <WidgetContent>{renderWidgetContent('map')}</WidgetContent>
                </WidgetCard>
              </Grid>

              <Grid item xs={12} md={6} sx={{ height: '50%' }}>
                <WidgetCard>
                  <WidgetHeader>
                    <FlightIcon sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">UAV Health</Typography>
                  </WidgetHeader>
                  <WidgetContent>{renderHealthPanel()}</WidgetContent>
                </WidgetCard>
              </Grid>

              <Grid item xs={12} md={6} sx={{ height: '50%' }}>
                <WidgetCard>
                  <WidgetHeader>
                    <BatteryIcon sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">Graphs</Typography>
                  </WidgetHeader>
                  <WidgetContent>
                    <Grid container spacing={2} sx={{ height: '100%' }}>
                      <Grid item xs={4} sx={{ height: '100%' }}>
                        <Typography variant="caption" sx={{ mb: 1, color: '#CCCCCC' }}>Battery (%)</Typography>
                        <ResponsiveContainer width="100%" height="80%">
                          <LineChart data={batteryHistoryGraph}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#555555" />
                            <XAxis dataKey="time" tick={{ fill: '#CCCCCC' }} />
                            <YAxis tick={{ fill: '#CCCCCC' }} />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#333333', color: '#FFFFFF' }} />
                            <Legend wrapperStyle={{ color: '#CCCCCC' }} />
                            <Line type="monotone" dataKey="value" stroke="#2A8A8C" strokeWidth={2} dot={{ r: 2 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </Grid>
                      <Grid item xs={4} sx={{ height: '100%' }}>
                        <Typography variant="caption" sx={{ mb: 1, color: '#CCCCCC' }}>Voltage (V)</Typography>
                        <ResponsiveContainer width="100%" height="80%">
                          <LineChart data={sensorHistory}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#555555" />
                            <XAxis dataKey="time" tick={{ fill: '#CCCCCC' }} />
                            <YAxis tick={{ fill: '#CCCCCC' }} />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#333333', color: '#FFFFFF' }} />
                            <Legend wrapperStyle={{ color: '#CCCCCC' }} />
                            <Line type="monotone" dataKey="value" stroke="#FF7E00" strokeWidth={2} dot={{ r: 2 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </Grid>
                      <Grid item xs={4} sx={{ height: '100%' }}>
                        <Typography variant="caption" sx={{ mb: 1, color: '#CCCCCC' }}>Current (A)</Typography>
                        <ResponsiveContainer width="100%" height="80%">
                          <LineChart data={actuatorHistory}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#555555" />
                            <XAxis dataKey="time" tick={{ fill: '#CCCCCC' }} />
                            <YAxis tick={{ fill: '#CCCCCC' }} />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#333333', color: '#FFFFFF' }} />
                            <Legend wrapperStyle={{ color: '#CCCCCC' }} />
                            <Line type="monotone" dataKey="value" stroke="#4caf50" strokeWidth={2} dot={{ r: 2 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </Grid>
                    </Grid>
                  </WidgetContent>
                </WidgetCard>
              </Grid>
              <Grid item xs={12} md={6} sx={{ height: '50%' }}>
                <WidgetCard>
                  <WidgetHeader>
                    <SpeedIcon sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">Telemetry Gauges</Typography>
                  </WidgetHeader>
                  <WidgetContent>
                    <Grid container spacing={2} sx={{ height: '100%' }}>
                      <Grid item xs={6} sx={{ display: 'flex', justifyContent: 'center' }}>
                        <CircularProgressWithLabel
                          value={telemetryData?.altitude || 0}
                          label="Altitude (m)"
                          max={1000}
                          color={
                            telemetryData?.altitude < 300 ? 'error' :
                            telemetryData?.altitude < 700 ? 'warning' : 'success'
                          }
                        />
                      </Grid>
                      <Grid item xs={6} sx={{ display: 'flex', justifyContent: 'center' }}>
                        <CircularProgressWithLabel
                          value={telemetryData?.battery || 0}
                          label="Battery (%)"
                          max={100}
                          color={
                            telemetryData?.battery < 30 ? 'error' :
                            telemetryData?.battery < 50 ? 'warning' : 'success'
                          }
                        />
                      </Grid>
                      <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center' }}>
                        <GaugeComponent
                          value={telemetryData?.speed || 0}
                          min={0} max={150}
                          title="Speed (km/h)"
                        />
                      </Grid>
                    </Grid>
                  </WidgetContent>
                </WidgetCard>
              </Grid>

            </Grid>
          </Box>

          <Snackbar
            open={warningOpen}
            autoHideDuration={5000}
            onClose={() => setWarningOpen(false)}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Alert severity="warning" onClose={() => setWarningOpen(false)}>
              {latestWarning}
            </Alert>
          </Snackbar>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;