import React from 'react';
import './Header.css';
import { FaPlane, FaHome, FaCog, FaBatteryThreeQuarters } from 'react-icons/fa';
import { MdSensors } from 'react-icons/md';

const Header = ({ activeTab, setActiveTab, isConnected }) => {
  const tabs = [
    { id: 0, label: 'Main Dashboard', icon: <FaHome /> },
    { id: 1, label: 'Actuators', icon: <MdSensors /> },
    { id: 2, label: 'Battery', icon: <FaBatteryThreeQuarters /> },
  ];

  return (
    <header className="header">
      <div className="header-top">
        {/* Logo */}
        <div className="logo-section">
          <div className="logo-icon">
            <FaPlane />
          </div>
          <div className="logo-text">
            <h1>UAV DIGITAL TWIN</h1>
            <p>Actuator Monitoring System</p>
          </div>
        </div>

        {/* Connection Status */}
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          <div className={`status-dot ${isConnected ? 'online' : 'offline'}`}></div>
          <span>{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
};

export default Header;