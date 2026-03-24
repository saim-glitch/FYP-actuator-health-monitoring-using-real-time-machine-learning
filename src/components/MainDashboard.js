import React from 'react';
import './MainDashboard.css';
import { FaPlane, FaWifi, FaCheckCircle, FaExclamationTriangle, FaBatteryThreeQuarters } from 'react-icons/fa';
import { MdSensors } from 'react-icons/md';

const MainDashboard = ({ data, isConnected }) => {
  return (
    <div className="dashboard-grid">
      {/* Welcome Card */}
      <div className="welcome-card">
        <div className="welcome-content">
          <h1>UAV Control Center</h1>
          <p>Real-time Actuator Monitoring & Anomaly Detection</p>
        </div>
        <FaPlane className="welcome-icon" />
      </div>

      {/* Connection Status Card */}
      <div 
        className="status-card"
        style={{ 
          '--card-color': isConnected ? '#00e676' : '#ff5252',
          '--card-glow': isConnected ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 82, 82, 0.3)'
        }}
      >
        <div 
          className="status-card-icon"
          style={{ 
            background: isConnected 
              ? 'linear-gradient(135deg, #00e676, #00c853)' 
              : 'linear-gradient(135deg, #ff5252, #d32f2f)',
            boxShadow: isConnected 
              ? '0 0 30px rgba(0, 230, 118, 0.5)' 
              : '0 0 30px rgba(255, 82, 82, 0.5)'
          }}
        >
          <FaWifi color="white" />
        </div>
        <h3>Connection</h3>
        <span 
          className="status-card-value"
          style={{ 
            background: isConnected ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 82, 82, 0.2)',
            color: isConnected ? '#00e676' : '#ff5252',
            border: `1px solid ${isConnected ? '#00e676' : '#ff5252'}`
          }}
        >
          {isConnected ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      {/* IR Sensor Card */}
      <div 
        className="status-card"
        style={{ 
          '--card-color': data.ir_sensor === 0 ? '#00e676' : '#ff5252',
          '--card-glow': data.ir_sensor === 0 ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 82, 82, 0.3)'
        }}
      >
        <div 
          className="status-card-icon"
          style={{ 
            background: data.ir_sensor === 0 
              ? 'linear-gradient(135deg, #00e676, #00c853)' 
              : 'linear-gradient(135deg, #ff5252, #d32f2f)',
            boxShadow: data.ir_sensor === 0 
              ? '0 0 30px rgba(0, 230, 118, 0.5)' 
              : '0 0 30px rgba(255, 82, 82, 0.5)',
            animation: data.ir_sensor === 1 ? 'pulse 1s infinite' : 'none'
          }}
        >
          <MdSensors color="white" />
        </div>
        <h3>IR Sensor</h3>
        <span 
          className="status-card-value"
          style={{ 
            background: data.ir_sensor === 0 ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 82, 82, 0.2)',
            color: data.ir_sensor === 0 ? '#00e676' : '#ff5252',
            border: `1px solid ${data.ir_sensor === 0 ? '#00e676' : '#ff5252'}`
          }}
        >
          {data.ir_sensor === 0 ? 'CLEAR' : 'DETECTED'}
        </span>
      </div>

      {/* Hall Sensor Card */}
      <div 
        className="status-card"
        style={{ 
          '--card-color': data.hall_sensor === 0 ? '#00d9ff' : '#ff6b9d',
          '--card-glow': data.hall_sensor === 0 ? 'rgba(0, 217, 255, 0.3)' : 'rgba(255, 107, 157, 0.3)'
        }}
      >
        <div 
          className="status-card-icon"
          style={{ 
            background: data.hall_sensor === 0 
              ? 'linear-gradient(135deg, #00d9ff, #0088cc)' 
              : 'linear-gradient(135deg, #ff6b9d, #e91e63)',
            boxShadow: data.hall_sensor === 0 
              ? '0 0 30px rgba(0, 217, 255, 0.5)' 
              : '0 0 30px rgba(255, 107, 157, 0.5)',
            animation: data.hall_sensor === 1 ? 'pulse 1s infinite' : 'none'
          }}
        >
          <MdSensors color="white" />
        </div>
        <h3>Hall Sensor</h3>
        <span 
          className="status-card-value"
          style={{ 
            background: data.hall_sensor === 0 ? 'rgba(0, 217, 255, 0.2)' : 'rgba(255, 107, 157, 0.2)',
            color: data.hall_sensor === 0 ? '#00d9ff' : '#ff6b9d',
            border: `1px solid ${data.hall_sensor === 0 ? '#00d9ff' : '#ff6b9d'}`
          }}
        >
          {data.hall_sensor === 0 ? 'CLEAR' : 'MAGNET'}
        </span>
      </div>

      {/* System Status Card */}
      <div 
        className="status-card"
        style={{ 
          '--card-color': data.anomaly === 0 ? '#00e676' : '#ff5252',
          '--card-glow': data.anomaly === 0 ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 82, 82, 0.3)',
          animation: data.anomaly === 1 ? 'blink 0.5s infinite' : 'none'
        }}
      >
        <div 
          className="status-card-icon"
          style={{ 
            background: data.anomaly === 0 
              ? 'linear-gradient(135deg, #00e676, #00c853)' 
              : 'linear-gradient(135deg, #ff5252, #d32f2f)',
            boxShadow: data.anomaly === 0 
              ? '0 0 30px rgba(0, 230, 118, 0.5)' 
              : '0 0 30px rgba(255, 82, 82, 0.5)'
          }}
        >
          {data.anomaly === 0 ? <FaCheckCircle color="white" /> : <FaExclamationTriangle color="white" />}
        </div>
        <h3>System Status</h3>
        <span 
          className="status-card-value"
          style={{ 
            background: data.anomaly === 0 ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 82, 82, 0.2)',
            color: data.anomaly === 0 ? '#00e676' : '#ff5252',
            border: `1px solid ${data.anomaly === 0 ? '#00e676' : '#ff5252'}`
          }}
        >
          {data.anomaly === 0 ? 'NORMAL' : 'ANOMALY!'}
        </span>
      </div>

      {/* Sensor Overview */}
      <div className="sensor-overview-card">
        <h2>📊 Sensor Overview</h2>
        <div className="sensor-overview-content">
          {/* IR */}
          <div className="sensor-mini-display">
            <div 
              className={`sensor-circle ${data.ir_sensor === 1 ? 'active' : ''}`}
              style={{ 
                background: data.ir_sensor === 0 
                  ? 'linear-gradient(135deg, #00e676, #00c853)' 
                  : 'linear-gradient(135deg, #ff5252, #d32f2f)',
                boxShadow: data.ir_sensor === 0 
                  ? '0 0 20px rgba(0, 230, 118, 0.5)' 
                  : '0 0 30px rgba(255, 82, 82, 0.6)'
              }}
            >
              <h3>{data.ir_sensor}</h3>
            </div>
            <p>IR Sensor</p>
            <span 
              className="sensor-status-badge"
              style={{ 
                background: data.ir_sensor === 0 ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 82, 82, 0.2)',
                color: data.ir_sensor === 0 ? '#00e676' : '#ff5252'
              }}
            >
              {data.ir_sensor === 0 ? 'CLEAR' : 'DETECTED'}
            </span>
          </div>

          {/* Hall */}
          <div className="sensor-mini-display">
            <div 
              className={`sensor-circle ${data.hall_sensor === 1 ? 'active' : ''}`}
              style={{ 
                background: data.hall_sensor === 0 
                  ? 'linear-gradient(135deg, #00d9ff, #0088cc)' 
                  : 'linear-gradient(135deg, #ff6b9d, #e91e63)',
                boxShadow: data.hall_sensor === 0 
                  ? '0 0 20px rgba(0, 217, 255, 0.5)' 
                  : '0 0 30px rgba(255, 107, 157, 0.6)'
              }}
            >
              <h3>{data.hall_sensor}</h3>
            </div>
            <p>Hall Sensor</p>
            <span 
              className="sensor-status-badge"
              style={{ 
                background: data.hall_sensor === 0 ? 'rgba(0, 217, 255, 0.2)' : 'rgba(255, 107, 157, 0.2)',
                color: data.hall_sensor === 0 ? '#00d9ff' : '#ff6b9d'
              }}
            >
              {data.hall_sensor === 0 ? 'CLEAR' : 'MAGNET'}
            </span>
          </div>

          {/* Status */}
          <div className="sensor-mini-display">
            <div 
              className={`sensor-circle ${data.anomaly === 1 ? 'active' : ''}`}
              style={{ 
                background: data.anomaly === 0 
                  ? 'linear-gradient(135deg, #00e676, #00c853)' 
                  : 'linear-gradient(135deg, #ff5252, #d32f2f)',
                boxShadow: data.anomaly === 0 
                  ? '0 0 20px rgba(0, 230, 118, 0.5)' 
                  : '0 0 30px rgba(255, 82, 82, 0.6)',
                animation: data.anomaly === 1 ? 'blink 0.5s infinite' : 'none'
              }}
            >
              <h3>{data.anomaly === 0 ? '✓' : '!'}</h3>
            </div>
            <p>Status</p>
            <span 
              className="sensor-status-badge"
              style={{ 
                background: data.anomaly === 0 ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 82, 82, 0.2)',
                color: data.anomaly === 0 ? '#00e676' : '#ff5252'
              }}
            >
              {data.anomaly === 0 ? 'NORMAL' : 'ANOMALY'}
            </span>
          </div>
        </div>
      </div>

      {/* Warnings */}
      <div className="warnings-card">
        <h2><FaExclamationTriangle /> Warnings & Alerts</h2>
        {data.warnings && data.warnings.length > 0 ? (
          <div className="warnings-list">
            {data.warnings.map((warning, index) => (
              <div key={index} className="warning-item">
                <FaExclamationTriangle />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-warnings">
            <FaCheckCircle />
            <p>All Systems Normal</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainDashboard;