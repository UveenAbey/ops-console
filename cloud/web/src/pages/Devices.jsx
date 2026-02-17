import React, { useState, useEffect } from 'react'
import './Devices.css'
import EnrollmentModal from '../components/EnrollmentModal'

const Devices = () => {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false)

  useEffect(() => {
    // Initial fetch
    fetchDevices()
    
    // Poll for updates every 5 seconds
    const pollInterval = setInterval(fetchDevices, 5000)
    
    return () => clearInterval(pollInterval)
  }, [])

  const fetchDevices = async () => {
    try {
      // Load from localStorage
      const savedDevices = localStorage.getItem('enrolledDevices')
      let localDevices = []
      
      if (savedDevices) {
        localDevices = JSON.parse(savedDevices)
      }
      
      setDevices(localDevices)
      
      // Try to fetch heartbeat status from API
      const response = await fetch('/api/devices')
      if (response.ok) {
        const data = await response.json()
        if (data.devices && data.devices.length > 0) {
          // Merge API heartbeat data with local device data
          const mergedDevices = localDevices.map(localDev => {
            // Try to find by enrollment key (check both formats)
            const heartbeatDev = data.devices.find(dev => 
              dev.enrollmentKey === localDev.enrollmentKey || 
              dev.enrollment_key === localDev.enrollmentKey
            )
            if (heartbeatDev) {
              // Update with heartbeat data (preserve name from localStorage)
              return {
                ...localDev,
                status: heartbeatDev.status || localDev.status || 'pending',
                cpu: heartbeatDev.cpu !== undefined ? heartbeatDev.cpu : heartbeatDev.cpu_usage_percent,
                memory: heartbeatDev.memory !== undefined ? heartbeatDev.memory : heartbeatDev.ram_usage_percent,
                ip: heartbeatDev.public_ip || localDev.ip || 'Unknown',
                lastSeen: heartbeatDev.lastSeen || heartbeatDev.last_seen
              }
            }
            return localDev
          })
          setDevices(mergedDevices)
          localStorage.setItem('enrolledDevices', JSON.stringify(mergedDevices))
        }
      }
    } catch (error) {
      console.error('Error fetching devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEnrollDevice = () => {
    console.log('Opening enrollment modal')
    setEnrollmentModalOpen(true)
  }

  const handleEnrollmentComplete = async (newDevice) => {
    console.log('Device enrolled:', newDevice)
    
    // Register device with API
    try {
      await fetch('/api/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentKey: newDevice.enrollmentKey,
          name: newDevice.name
        })
      })
    } catch (error) {
      console.error('Failed to register device with API:', error)
    }
    
    setDevices(prev => {
      const updated = [...prev, newDevice]
      // Save to localStorage
      localStorage.setItem('enrolledDevices', JSON.stringify(updated))
      return updated
    })
  }

  const handleDeviceSettings = (device) => {
    setSelectedDevice(device)
    setDeviceSettingsOpen(true)
  }

  const handleDeleteDevice = () => {
    if (selectedDevice && window.confirm(`Are you sure you want to remove ${selectedDevice.name}?`)) {
      setDevices(prev => {
        const updated = prev.filter(dev => dev.id !== selectedDevice.id)
        localStorage.setItem('enrolledDevices', JSON.stringify(updated))
        return updated
      })
      setDeviceSettingsOpen(false)
      setSelectedDevice(null)
    }
  }

  if (loading && devices.length === 0) {
    return <div className="loading">Loading devices...</div>
  }

  return (
    <>
      {devices.length === 0 ? (
        <div className="devices-page">
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">💻</div>
              <h3 className="empty-state-title">No devices enrolled yet</h3>
              <p className="empty-state-text">
                Enroll your first device to start monitoring
              </p>
              <button className="btn btn-primary" onClick={handleEnrollDevice} style={{ marginTop: '20px' }}>
                Enroll Device
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="devices-page">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">All Devices</h2>
              <button className="btn btn-primary" onClick={handleEnrollDevice}>
                ➕ Enroll Device
              </button>
            </div>

            <div className="devices-table">
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Status</th>
                    <th>IP Address</th>
                    <th>CPU</th>
                    <th>Memory</th>
                    <th>Last Seen</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.id}>
                      <td>
                        <div className="device-name">{device.name}</div>
                        <div className="device-type">{device.type}</div>
                      </td>
                      <td>
                        <span className={`badge badge-${device.status === 'online' ? 'success' : device.status === 'pending' ? 'warning' : 'gray'}`}>
                          <span className={`status-dot status-${device.status}`}></span>
                          {device.status}
                        </span>
                      </td>
                      <td>{device.ip || 'Waiting...'}</td>
                      <td>{device.cpu || '-'}%</td>
                      <td>{device.memory || '-'}%</td>
                      <td>{device.lastSeen || 'Not yet'}</td>
                      <td>
                        <button className="btn-icon" onClick={() => handleDeviceSettings(device)} title="Device settings">⚙️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      <EnrollmentModal
        isOpen={enrollmentModalOpen}
        onClose={() => setEnrollmentModalOpen(false)}
        onEnroll={handleEnrollmentComplete}
        existingDevices={devices}
      />
      
      {deviceSettingsOpen && selectedDevice && (
        <div className="modal-overlay" onClick={() => setDeviceSettingsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚙️ Device Settings</h2>
              <button className="modal-close" onClick={() => setDeviceSettingsOpen(false)}>✕</button>
            </div>

            <div className="device-settings-content">
              <div className="settings-item">
                <label>Device Name:</label>
                <span>{selectedDevice.name}</span>
              </div>
              <div className="settings-item">
                <label>Device Type:</label>
                <span>{selectedDevice.type}</span>
              </div>
              <div className="settings-item">
                <label>Status:</label>
                <span className={`badge badge-${selectedDevice.status === 'online' ? 'success' : selectedDevice.status === 'pending' ? 'warning' : 'gray'}`}>
                  {selectedDevice.status}
                </span>
              </div>
              <div className="settings-item">
                <label>Enrollment Key:</label>
                <span className="enrollment-key-display">{selectedDevice.enrollmentKey}</span>
              </div>
              <div className="settings-item">
                <label>Enrolled At:</label>
                <span>{new Date(selectedDevice.enrolledAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="modal-buttons">
              <button className="btn btn-danger" onClick={handleDeleteDevice}>
                Remove Device
              </button>
              <button className="btn btn-secondary" onClick={() => setDeviceSettingsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Devices
