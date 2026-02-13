import React, { useState, useEffect } from 'react'
import './Alerts.css'

const Alerts = () => {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, critical, warning, info

  useEffect(() => {
    fetchAlerts()
  }, [])

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/alerts')
      const data = await response.json()
      // Handle response - for now, it's a placeholder endpoint
      setAlerts([])
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading alerts...</div>
  }

  const filteredAlerts = filter === 'all' 
    ? alerts 
    : alerts.filter(alert => alert.severity === filter)

  return (
    <div className="alerts-page">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Alerts</h2>
          <div className="alert-filters">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button 
              className={`filter-btn ${filter === 'critical' ? 'active' : ''}`}
              onClick={() => setFilter('critical')}
            >
              Critical
            </button>
            <button 
              className={`filter-btn ${filter === 'warning' ? 'active' : ''}`}
              onClick={() => setFilter('warning')}
            >
              Warning
            </button>
            <button 
              className={`filter-btn ${filter === 'info' ? 'active' : ''}`}
              onClick={() => setFilter('info')}
            >
              Info
            </button>
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔔</div>
            <h3 className="empty-state-title">No alerts</h3>
            <p className="empty-state-text">
              {filter === 'all' 
                ? 'All systems are running smoothly'
                : `No ${filter} alerts at this time`}
            </p>
          </div>
        ) : (
          <div className="alerts-list">
            {filteredAlerts.map((alert) => (
              <div key={alert.id} className={`alert-item alert-${alert.severity}`}>
                <div className="alert-icon">
                  {alert.severity === 'critical' && '🔴'}
                  {alert.severity === 'warning' && '⚠️'}
                  {alert.severity === 'info' && 'ℹ️'}
                </div>
                <div className="alert-content">
                  <div className="alert-header">
                    <h4 className="alert-title">{alert.title}</h4>
                    <span className={`badge badge-${
                      alert.severity === 'critical' ? 'danger' : 
                      alert.severity === 'warning' ? 'warning' : 'gray'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="alert-message">{alert.message}</p>
                  <div className="alert-footer">
                    <span className="alert-device">{alert.device}</span>
                    <span className="alert-time">{alert.time}</span>
                  </div>
                </div>
                <div className="alert-actions">
                  <button className="btn btn-secondary btn-sm">
                    Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Alerts
