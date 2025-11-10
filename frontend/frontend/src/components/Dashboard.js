import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Dashboard({ user, onLogout, refreshUser }) {
  const [server, setServer] = useState(null);
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchServerStats();
    if (user.hasActiveServer) {
      fetchMyServer();
    }
    
    // Refresh user data every 30 seconds
    const interval = setInterval(() => {
      refreshUser();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [user.hasActiveServer]);

  const fetchMyServer = async () => {
    try {
      const response = await axios.get('/servers/my-server');
      setServer(response.data);
    } catch (error) {
      console.error('Error fetching server:', error);
    }
  };

  const fetchServerStats = async () => {
    try {
      const response = await axios.get('/servers/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const requestServer = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await axios.post('/servers/request');
      setMessage(response.data.message);
      await refreshUser();
      await fetchMyServer();
      await fetchServerStats();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to request server');
    } finally {
      setLoading(false);
    }
  };

  const releaseServer = async () => {
    if (!window.confirm('Are you sure you want to release your server?')) {
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await axios.post('/servers/release');
      setMessage(response.data.message);
      setServer(null);
      await refreshUser();
      await fetchServerStats();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to release server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="nav-content">
          <div className="nav-logo">
            <span className="logo">🐞</span>
            <span>Ladybug Bot Hosting</span>
          </div>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="dashboard-container">
        <div className="welcome-section">
          <h1>Welcome, {user.username}!</h1>
          <div className="coin-display">
            <span className="coin-icon">🪙</span>
            <span className="coin-amount">{user.coins} Coins</span>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="cards-container">
          <div className="card">
                <h2>Your Server Status</h2>
            {server ? (
              <div className="server-info">
                <div className="status-badge active">✓ Active</div>
                <p><strong>Server Name:</strong> {server.serverName}</p>
                <p><strong>Assigned At:</strong> {new Date(server.assignedAt).toLocaleString()}</p>
                <div className="server-actions">
                  <button onClick={releaseServer} className="btn-danger" disabled={loading}>
                    Release Server
                  </button>
                </div>
                <div className="info-box">
                  <p>ℹ️ Your server is active and running. Coins are deducted hourly.</p>
                </div>
              </div>
            ) : (
              <div className="server-info">
                <div className="status-badge inactive">✗ No Active Server</div>
                <p>You don't have an active server yet.</p>
                <button 
                  onClick={requestServer} 
                  className="btn-primary" 
                  disabled={loading || user.coins <= 0}
                >
                  {loading ? 'Requesting...' : 'Request Free Server'}
                </button>
                {user.coins <= 0 && (
                  <div className="warning-box">
                    <p>⚠️ You don't have enough coins to request a server.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Server Statistics</h2>
            {stats ? (
              <div className="stats-info">
                <div className="stat-item">
                  <span className="stat-label">Total Servers:</span>
                  <span className="stat-value">{stats.totalServers}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Available Servers:</span>
                  <span className="stat-value available">{stats.availableServers}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Active Servers:</span>
                  <span className="stat-value active">{stats.activeServers}</span>
                </div>
              </div>
            ) : (
              <p>Loading statistics...</p>
            )}
          </div>

          <div className="card">
            <h2>About Ladybug Bot</h2>
            <div className="about-info">
              <p>
                Ladybug Bot is a powerful Discord bot designed to enhance your server experience.
              </p>
              <div className="bot-features">
                <h3>Features:</h3>
                <ul>
                  <li>🎵 Music playback</li>
                  <li>🛡️ Moderation tools</li>
                  <li>🎮 Fun commands</li>
                  <li>📊 Server statistics</li>
                  <li>⚙️ Customizable settings</li>
                </ul>
              </div>
              <a 
                href="https://github.com/mrntando-dev/Ladybug-Bot" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-link"
              >
                View on GitHub →
              </a>
            </div>
          </div>

          <div className="card">
            <h2>How It Works</h2>
            <div className="how-it-works">
              <div className="step">
                <span className="step-number">1</span>
                <p>Request a free server when available</p>
              </div>
              <div className="step">
                <span className="step-number">2</span>
                <p>Your Ladybug Bot will be hosted automatically</p>
              </div>
              <div className="step">
                <span className="step-number">3</span>
                <p>Coins are deducted hourly (1 coin/hour)</p>
              </div>
              <div className="step">
                <span className="step-number">4</span>
                <p>When coins run out, your server is released</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
