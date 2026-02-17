import React, { useState } from 'react'
import './EnrollmentModal.css'

const EnrollmentModal = ({ isOpen, onClose, onEnroll, existingDevices = [] }) => {
  const [deviceName, setDeviceName] = useState('')
  const [deviceType, setDeviceType] = useState('server')
  const [enrollmentKey, setEnrollmentKey] = useState(null)
  const [enrollmentStep, setEnrollmentStep] = useState('form') // form, key, success
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerateKey = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!deviceName.trim()) {
      setError('Please enter a device name')
      return
    }

    // Check for duplicate device names
    if (existingDevices.some(dev => dev.name.toLowerCase() === deviceName.toLowerCase())) {
      setError(`A device named "${deviceName}" already exists. Please use a different name.`)
      return
    }

    setLoading(true)
    try {
      // Generate a unique enrollment key
      const key = `ENR-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`
      setEnrollmentKey(key)
      setEnrollmentStep('key')
    } catch (err) {
      console.error('Error generating enrollment key:', err)
      setError('Failed to generate enrollment key')
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteEnrollment = () => {
    const newDevice = {
      id: `device-${Date.now()}`,
      name: deviceName,
      type: deviceType,
      enrollmentKey: enrollmentKey,
      status: 'pending',
      enrolledAt: new Date().toISOString()
    }
    
    onEnroll(newDevice)
    setEnrollmentStep('success')
    
    setTimeout(() => {
      resetModal()
      onClose()
    }, 2000)
  }

  const resetModal = () => {
    setDeviceName('')
    setDeviceType('server')
    setEnrollmentKey(null)
    setEnrollmentStep('form')
    setError('')
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔧 Enroll New Device</h2>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        {enrollmentStep === 'form' && (
          <form onSubmit={handleGenerateKey}>
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-group">
              <label htmlFor="deviceName">Device Name</label>
              <input
                id="deviceName"
                type="text"
                placeholder="e.g., Web Server 01"
                value={deviceName}
                onChange={(e) => {
                  setDeviceName(e.target.value)
                  setError('')
                }}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="deviceType">Device Type</label>
              <select
                id="deviceType"
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value)}
              >
                <option value="server">Server</option>
                <option value="workstation">Workstation</option>
                <option value="network">Network Device</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="modal-buttons">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Generating...' : 'Generate Enrollment Key'}
              </button>
            </div>
          </form>
        )}

        {enrollmentStep === 'key' && (
          <div className="enrollment-key-section">
            <div className="success-icon">✓</div>
            <p className="enrollment-message">Enrollment key generated for <strong>{deviceName}</strong></p>
            
            <div className="key-box">
              <input
                type="text"
                value={enrollmentKey}
                readOnly
                className="key-input"
              />
              <button
                className="btn-copy"
                onClick={() => {
                  navigator.clipboard.writeText(enrollmentKey)
                  alert('Enrollment key copied to clipboard!')
                }}
              >
                📋 Copy
              </button>
            </div>

            <div className="instructions">
              <h3>Installation Instructions:</h3>
              <ol>
                <li>Download the xSPECTRE agent from our downloads page</li>
                <li>Run the installer on the device</li>
                <li>When prompted, enter this enrollment key</li>
                <li>The device will automatically connect and appear as online</li>
              </ol>
            </div>

            <div className="modal-buttons">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCompleteEnrollment}
              >
                Enrollment Pending
              </button>
            </div>
          </div>
        )}

        {enrollmentStep === 'success' && (
          <div className="success-section">
            <div className="success-icon large">✓</div>
            <h3>Device Enrollment Initiated!</h3>
            <p>Waiting for <strong>{deviceName}</strong> to connect...</p>
            <div className="spinner"></div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EnrollmentModal
