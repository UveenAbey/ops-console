import React, { useState } from 'react'
import './Settings.css'

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState({
    consoleName: 'xSPECTRE Ops Console',
    consoleUrl: 'http://192.168.1.58:3000',
    heartbeatInterval: 60,
    alertEmail: 'admin@xspectre.internal'
  })

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSaveSettings = () => {
    localStorage.setItem('consoleSettings', JSON.stringify(settings))
    alert('Settings saved successfully!')
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Configure your xSPECTRE Ops Console</p>
      </div>

      <div className="settings-container">
        <div className="settings-sidebar">
          <div className="settings-nav">
            <button 
              className={`settings-nav-item ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <span className="settings-nav-icon">⚙️</span>
              <span>General</span>
            </button>
            <button 
              className={`settings-nav-item ${activeTab === 'agents' ? 'active' : ''}`}
              onClick={() => setActiveTab('agents')}
            >
              <span className="settings-nav-icon">🤖</span>
              <span>Agent Settings</span>
            </button>
            <button 
              className={`settings-nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
              onClick={() => setActiveTab('alerts')}
            >
              <span className="settings-nav-icon">🔔</span>
              <span>Alert Rules</span>
            </button>
            <button 
              className={`settings-nav-item ${activeTab === 'backup' ? 'active' : ''}`}
              onClick={() => setActiveTab('backup')}
            >
              <span className="settings-nav-icon">💾</span>
              <span>Backup</span>
            </button>
            <button 
              className={`settings-nav-item ${activeTab === 'api' ? 'active' : ''}`}
              onClick={() => setActiveTab('api')}
            >
              <span className="settings-nav-icon">🔑</span>
              <span>API Keys</span>
            </button>
          </div>
        </div>

        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-section">
              <h2 className="section-title">General Settings</h2>
              
              <div className="form-group">
                <label className="form-label">Console Name</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={settings.consoleName}
                  onChange={(e) => handleSettingChange('consoleName', e.target.value)}
                  placeholder="Enter console name"
                />
                <p className="form-hint">Display name for your console</p>
              </div>

              <div className="form-group">
                <label className="form-label">Console URL</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={settings.consoleUrl}
                  onChange={(e) => handleSettingChange('consoleUrl', e.target.value)}
                  placeholder="http://your-console-url:3000"
                />
                <p className="form-hint">URL agents will use to connect to this console</p>
              </div>

              <div className="form-group">
                <label className="form-label">Alert Email</label>
                <input 
                  type="email" 
                  className="form-input"
                  value={settings.alertEmail}
                  onChange={(e) => handleSettingChange('alertEmail', e.target.value)}
                  placeholder="admin@company.com"
                />
                <p className="form-hint">Email address for alert notifications</p>
              </div>

              <button className="btn btn-primary" onClick={handleSaveSettings}>
                Save Changes
              </button>
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="settings-section">
              <h2 className="section-title">Agent Settings</h2>
              
              <div className="form-group">
                <label className="form-label">Heartbeat Interval (seconds)</label>
                <input 
                  type="number" 
                  className="form-input"
                  value={settings.heartbeatInterval}
                  onChange={(e) => handleSettingChange('heartbeatInterval', parseInt(e.target.value))}
                  min="5"
                  max="3600"
                />
                <p className="form-hint">How often agents send metrics (5-3600 seconds)</p>
              </div>

              <div className="info-box">
                <h4>Current Agents Online</h4>
                <p>0 agents are currently connected to the console</p>
              </div>

              <button className="btn btn-primary" onClick={handleSaveSettings}>
                Save Changes
              </button>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="settings-section">
              <h2 className="section-title">Alert Rules</h2>
              
              <div className="alert-rules">
                <div className="rule-item">
                  <div className="rule-header">
                    <h4>High CPU Usage</h4>
                    <span className="badge badge-success">Enabled</span>
                  </div>
                  <p className="rule-desc">Alert when CPU usage exceeds 90% for 5 minutes</p>
                  <button className="btn btn-small">Edit</button>
                </div>

                <div className="rule-item">
                  <div className="rule-header">
                    <h4>High Memory Usage</h4>
                    <span className="badge badge-success">Enabled</span>
                  </div>
                  <p className="rule-desc">Alert when memory usage exceeds 85% for 5 minutes</p>
                  <button className="btn btn-small">Edit</button>
                </div>

                <div className="rule-item">
                  <div className="rule-header">
                    <h4>Device Offline</h4>
                    <span className="badge badge-success">Enabled</span>
                  </div>
                  <p className="rule-desc">Alert when device misses 3 consecutive heartbeats</p>
                  <button className="btn btn-small">Edit</button>
                </div>
              </div>

              <button className="btn btn-secondary">Add New Rule</button>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="settings-section">
              <h2 className="section-title">Backup Settings</h2>
              
              <div className="form-group">
                <label className="form-label">Backup Schedule</label>
                <select className="form-input">
                  <option>Daily (3:00 AM UTC)</option>
                  <option>Weekly (Sunday 3:00 AM UTC)</option>
                  <option>Monthly (1st of month 3:00 AM UTC)</option>
                </select>
              </div>

              <div className="info-box">
                <h4>Last Backup</h4>
                <p>No backups yet</p>
              </div>

              <button className="btn btn-primary">Enable Backups</button>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="settings-section">
              <h2 className="section-title">API Keys</h2>
              
              <p className="section-description">Manage API keys for programmatic access to the xSPECTRE console</p>
              
              <div className="api-keys">
                <div className="api-key-item">
                  <div className="key-name">Default API Key</div>
                  <div className="key-value">sk_live_••••••••••••••••</div>
                  <div className="key-actions">
                    <button className="btn btn-small">Reveal</button>
                    <button className="btn btn-small btn-danger">Revoke</button>
                  </div>
                </div>
              </div>

              <button className="btn btn-primary">Generate New Key</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings
