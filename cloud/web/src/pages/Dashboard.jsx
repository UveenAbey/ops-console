import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'
import EnrollmentModal from '../components/EnrollmentModal'

const Dashboard = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    activeAlerts: 0
  })
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false)
  const [apiStatus, setApiStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
    
    // Poll for updates every 10 seconds
    const pollInterval = setInterval(fetchDashboardData, 10000)
    
    return () => clearInterval(pollInterval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Fetch API health
      const healthResponse = await fetch('/health')
      const healthData = await healthResponse.json()
      setApiStatus(healthData)

      // Fetch device stats from API
      const token = localStorage.getItem('authToken')
      const devicesResponse = await fetch('/api/devices', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (devicesResponse.ok) {
        const devicesData = await devicesResponse.json()
        const devices = devicesData.devices || []
        
        setStats({
          totalDevices: devices.length,
          onlineDevices: devices.filter(d => d.status === 'online').length,
          offlineDevices: devices.filter(d => d.status !== 'online').length,
          activeAlerts: 0
        })
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEnrollDevice = () => {
    console.log('Opening enrollment modal')
    setEnrollmentModalOpen(true)
  }

  const handleEnrollmentComplete = (newDevice) => {
    console.log('Device enrolled:', newDevice)
    // Update stats
    setStats(prev => ({
      ...prev,
      totalDevices: prev.totalDevices + 1
    }))
  }

  const handleViewLogs = () => {
    console.log('View Logs button clicked')
    alert('📋 Logs viewer coming soon!\n\nBrowse and filter system logs, API access logs, and device activity.')
  }

  const handleSettings = () => {
    navigate('/settings')
  }

  if (loading) {
    return <div className="loading">Loading dashboard...</div>
  }

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-primary">💻</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalDevices}</div>
            <div className="stat-label">Total Devices</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-success">✓</div>
          <div className="stat-content">
            <div className="stat-value">{stats.onlineDevices}</div>
            <div className="stat-label">Online</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-gray">○</div>
          <div className="stat-content">
            <div className="stat-value">{stats.offlineDevices}</div>
            <div className="stat-label">Offline</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-danger">🔔</div>
          <div className="stat-content">
            <div className="stat-value">{stats.activeAlerts}</div>
            <div className="stat-label">Active Alerts</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">System Status</h2>
            {apiStatus && (
              <span className="badge badge-success">
                <span className="status-dot status-online"></span>
                Healthy
              </span>
            )}
          </div>
          {apiStatus && (
            <div className="status-info">
              <div className="status-item">
                <span className="status-label">API Version:</span>
                <span className="status-value">{apiStatus.version}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Uptime:</span>
                <span className="status-value">{Math.floor(apiStatus.uptime)}s</span>
              </div>
              <div className="status-item">
                <span className="status-label">Status:</span>
                <span className="status-value">{apiStatus.status}</span>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Quick Actions</h2>
          </div>
          <div className="quick-actions">
            <button className="action-btn" onClick={handleEnrollDevice}>
              <span className="action-icon">➕</span>
              <div className="action-content">
                <div className="action-title">Enroll Device</div>
                <div className="action-desc">Add a new device to monitor</div>
              </div>
            </button>
            <button className="action-btn" onClick={handleViewLogs}>
              <span className="action-icon">📋</span>
              <div className="action-content">
                <div className="action-title">View Logs</div>
                <div className="action-desc">Check system logs</div>
              </div>
            </button>
            <button className="action-btn" onClick={handleSettings}>
              <span className="action-icon">⚙️</span>
              <div className="action-content">
                <div className="action-title">Settings</div>
                <div className="action-desc">Configure console</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {stats.totalDevices === 0 && (
        <div className="card welcome-card">
          <div className="welcome-content">
            <h2>👋 Welcome to xSPECTRE Ops Console!</h2>
            <p>Get started by enrolling your first device. Once devices are connected, you'll see real-time metrics, alerts, and backups here.</p>
            <button className="btn btn-primary" onClick={handleEnrollDevice} style={{ marginTop: '16px' }}>
              Enroll First Device
            </button>
          </div>
        </div>
      )}

      <EnrollmentModal
        isOpen={enrollmentModalOpen}
        onClose={() => setEnrollmentModalOpen(false)}
        onEnroll={handleEnrollmentComplete}
      />
    </div>
  )
}

export default Dashboard
