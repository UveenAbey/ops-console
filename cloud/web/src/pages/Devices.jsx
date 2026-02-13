import React, { useState, useEffect } from 'react'
import './Devices.css'

const Devices = () => {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDevices()
  }, [])

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/devices')
      const data = await response.json()
      // Handle response - for now, it's a placeholder endpoint
      setDevices([])
    } catch (error) {
      console.error('Error fetching devices:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading devices...</div>
  }

  if (devices.length === 0) {
    return (
      <div className="devices-page">
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">💻</div>
            <h3 className="empty-state-title">No devices enrolled yet</h3>
            <p className="empty-state-text">
              Enroll your first device to start monitoring
            </p>
            <button className="btn btn-primary" style={{ marginTop: '20px' }}>
              Enroll Device
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="devices-page">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">All Devices</h2>
          <button className="btn btn-primary">
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
                    <span className={`badge badge-${device.status === 'online' ? 'success' : 'gray'}`}>
                      <span className={`status-dot status-${device.status}`}></span>
                      {device.status}
                    </span>
                  </td>
                  <td>{device.ip}</td>
                  <td>{device.cpu}%</td>
                  <td>{device.memory}%</td>
                  <td>{device.lastSeen}</td>
                  <td>
                    <button className="btn-icon">⚙️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Devices
