import React, { useState } from 'react'
import './Downloads.css'

const Downloads = () => {
  const [selectedOS, setSelectedOS] = useState('windows')
  const [copiedCommand, setCopiedCommand] = useState(null)

  const downloads = {
    windows: [
      {
        name: 'xSPECTRE Agent (Windows x64)',
        version: '1.0.0',
        size: '45.2 MB',
        file: 'xspectre-agent-1.0.0-x64.msi',
        requirements: 'Windows 7+, .NET Framework 4.5+',
        command: `powershell -Command "
  # Download xSPECTRE Agent
  $ProgressPreference = 'SilentlyContinue'
  Invoke-WebRequest -Uri 'http://192.168.1.58:3000/downloads/xspectre-agent-1.0.0-x64.msi' -OutFile 'xspectre-agent.msi'
  
  # Run installer (will prompt for enrollment key)
  Start-Process msiexec.exe -ArgumentList '/i xspectre-agent.msi' -Wait
"`,
        instructions: [
          'Copy the command above',
          'Open PowerShell as Administrator',
          'Paste and run the command',
          'Follow the installer wizard',
          'Enter your enrollment key when prompted'
        ]
      }
    ],
    linux: [
      {
        name: 'xSPECTRE Agent (Linux x64)',
        version: '1.0.0',
        size: '38.5 MB',
        file: 'xspectre-agent-1.0.0-x64.tar.gz',
        requirements: 'Linux kernel 2.6+, glibc 2.12+',
        command: `curl -O http://192.168.1.58:3000/downloads/xspectre-agent-1.0.0-x64.tar.gz && \\
tar -xzf xspectre-agent-1.0.0-x64.tar.gz && \\
cd xspectre-agent-1.0.0 && \\
sudo ./install.sh`,
        instructions: [
          'Copy the command above',
          'Open a terminal',
          'Paste and run the command',
          'Enter your enrollment key when prompted',
          'The agent will start as a systemd service'
        ]
      }
    ],
    macos: [
      {
        name: 'xSPECTRE Agent (macOS)',
        version: '1.0.0',
        size: '42.1 MB',
        file: 'xspectre-agent-1.0.0.dmg',
        requirements: 'macOS 10.12+, Intel or Apple Silicon',
        command: `curl -O http://192.168.1.58:3000/downloads/xspectre-agent-1.0.0.dmg && \\
hdiutil attach xspectre-agent-1.0.0.dmg && \\
sudo installer -pkg /Volumes/xSPECTRE\\ Agent/xspectre-agent.pkg -target /`,
        instructions: [
          'Copy the command above',
          'Open Terminal',
          'Paste and run the command',
          'Enter your administrator password',
          'Enter your enrollment key in the agent settings'
        ]
      }
    ]
  }

  const currentDownloads = downloads[selectedOS]

  const copyToClipboard = (command, idx) => {
    navigator.clipboard.writeText(command.replace(/\\$/g, '').trim())
    setCopiedCommand(idx)
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  return (
    <div className="downloads-page">
      <div className="page-header">
        <h1>📥 Downloads</h1>
        <p>Download the xSPECTRE Agent and tools to get started</p>
      </div>

      <div className="card">
        <div className="section">
          <h2>xSPECTRE Agent</h2>
          <p className="section-desc">The lightweight agent that runs on your devices and communicates with the console</p>

          <div className="os-selector">
            <button
              className={`os-btn ${selectedOS === 'windows' ? 'active' : ''}`}
              onClick={() => setSelectedOS('windows')}
            >
              🪟 Windows
            </button>
            <button
              className={`os-btn ${selectedOS === 'linux' ? 'active' : ''}`}
              onClick={() => setSelectedOS('linux')}
            >
              🐧 Linux
            </button>
            <button
              className={`os-btn ${selectedOS === 'macos' ? 'active' : ''}`}
              onClick={() => setSelectedOS('macos')}
            >
              🍎 macOS
            </button>
          </div>

          <div className="download-cards">
            {currentDownloads.map((download, idx) => (
              <div key={idx} className="download-card">
                <div className="download-header">
                  <div>
                    <h3>{download.name}</h3>
                    <p className="download-version">v{download.version}</p>
                  </div>
                  <span className="download-size">{download.size}</span>
                </div>

                <div className="download-details">
                  <div className="detail-item">
                    <span className="detail-label">File:</span>
                    <span className="detail-value">{download.file}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Requirements:</span>
                    <span className="detail-value">{download.requirements}</span>
                  </div>
                </div>

                <div className="installation-guide">
                  <h4>Installation Command:</h4>
                  <div className="command-box">
                    <pre className="command-text">{download.command}</pre>
                    <button
                      className="btn-copy-command"
                      onClick={() => copyToClipboard(download.command, idx)}
                      title="Copy to clipboard"
                    >
                      {copiedCommand === idx ? '✓ Copied!' : '📋 Copy'}
                    </button>
                  </div>

                  <h4>Quick Steps:</h4>
                  <ol>
                    {download.instructions.map((step, stepIdx) => (
                      <li key={stepIdx}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <h2>Additional Tools</h2>

          <div className="tools-grid">
            <div className="tool-card">
              <div className="tool-icon">🔧</div>
              <h3>CLI Tool</h3>
              <p>Command-line interface for managing devices and alerts</p>
              <button className="btn btn-secondary" onClick={() => handleToolDownload('CLI Tool')}>Download</button>
            </div>

            <div className="tool-card">
              <div className="tool-icon">📱</div>
              <h3>Mobile App</h3>
              <p>Monitor devices on the go with the xSPECTRE mobile app</p>
              <button className="btn btn-secondary" onClick={() => handleToolDownload('Mobile App')}>Download</button>
            </div>

            <div className="tool-card">
              <div className="tool-icon">📚</div>
              <h3>Documentation</h3>
              <p>Complete guides and API documentation</p>
              <button className="btn btn-secondary" onClick={() => handleToolDownload('Documentation')}>View Docs</button>
            </div>

            <div className="tool-card">
              <div className="tool-icon">🔌</div>
              <h3>Plugins</h3>
              <p>Extend xSPECTRE with custom plugins and integrations</p>
              <button className="btn btn-secondary" onClick={() => handleToolDownload('Plugins')}>Browse</button>
            </div>
          </div>
        </div>

        <div className="section">
          <h2>System Requirements</h2>
          <div className="requirements">
            <div className="req-item">
              <span className="req-icon">💾</span>
              <div>
                <h4>Disk Space</h4>
                <p>Minimum 100 MB free disk space</p>
              </div>
            </div>
            <div className="req-item">
              <span className="req-icon">🔌</span>
              <div>
                <h4>Network</h4>
                <p>Stable internet connection for console communication</p>
              </div>
            </div>
            <div className="req-item">
              <span className="req-icon">🔐</span>
              <div>
                <h4>Permissions</h4>
                <p>Administrator/root access required for installation</p>
              </div>
            </div>
            <div className="req-item">
              <span className="req-icon">⚡</span>
              <div>
                <h4>CPU</h4>
                <p>Any modern multi-core processor (1+ GHz)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Downloads
