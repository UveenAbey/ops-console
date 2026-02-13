import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Layout.css'

const Layout = ({ children, onLogout }) => {
  const location = useLocation()
  const [wsStatus, setWsStatus] = useState('disconnected')

  useEffect(() => {
    // WebSocket connection for real-time updates
    const ws = new WebSocket(`ws://${window.location.hostname}:3000/ws`)
    
    ws.onopen = () => {
      console.log('WebSocket connected')
      setWsStatus('connected')
    }
    
    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setWsStatus('disconnected')
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setWsStatus('error')
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('WebSocket message:', data)
        // Handle real-time updates here
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }
    
    return () => {
      ws.close()
    }
  }, [])

  const isActive = (path) => location.pathname === path

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">xSPECTRE</span>
          </div>
          <div className="logo-subtitle">Ops Console</div>
        </div>

        <nav className="sidebar-nav">
          <Link 
            to="/" 
            className={`nav-item ${isActive('/') ? 'active' : ''}`}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-text">Dashboard</span>
          </Link>
          
          <Link 
            to="/devices" 
            className={`nav-item ${isActive('/devices') ? 'active' : ''}`}
          >
            <span className="nav-icon">💻</span>
            <span className="nav-text">Devices</span>
          </Link>
          
          <Link 
            to="/alerts" 
            className={`nav-item ${isActive('/alerts') ? 'active' : ''}`}
          >
            <span className="nav-icon">🔔</span>
            <span className="nav-text">Alerts</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="ws-status">
            <span className={`status-dot status-${wsStatus === 'connected' ? 'online' : 'offline'}`}></span>
            <span className="status-text">
              {wsStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="header">
          <div className="header-left">
            <h1 className="page-title">
              {location.pathname === '/' && 'Dashboard'}
              {location.pathname === '/devices' && 'Devices'}
              {location.pathname === '/alerts' && 'Alerts'}
            </h1>
          </div>
          <div className="header-right">
            <button className="btn btn-secondary" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="content">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
