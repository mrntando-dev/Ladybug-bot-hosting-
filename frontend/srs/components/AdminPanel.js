import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AdminPanel({ user, onLogout }) {
  const [servers, setServers] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [newServer, setNewServer] = useState({
    serverName: '',
    sillyHostingUrl: '',
    sillyUsername: '',
    sillyPassword: ''
  });

  const [coinData, setCoinData] = useState({
    userId: '',
    amount: 0
  });

  useEffect(() => {
    fetchServers();
    fetchUsers();
  }, []);

  const fetchServers = async () => {
    try {
      const response = await axios.get('/admin/servers');
      setServers(response.data);
    } catch (error) {
      setError('Failed to fetch servers');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/admin/users');
      setUsers(response.data);
    } catch (error) {
      setError('Failed to fetch users');
    }
  };

  const handleAddServer = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await axios.post('/admin/servers', newServer);
      setMessage('Server added successfully!');
      setNewServer({
        serverName: '',
        sillyHostingUrl: '',
        sillyUsername: '',
        sillyPassword: ''
      });
      setShowAddServer(false);
      await fetchServers();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to add server');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteServer = async (serverId) => {
    if (!window.confirm('Are you sure you want to delete this server?')) {
      return;
    }

    try {
      await axios.delete(`/admin/servers/${serverId}`);
      setMessage('Server deleted successfully!');
      await fetchServers();
    } catch (error) {
      setError('Failed to delete server');
    }
  };

  const handleReleaseServer = async (serverId) => {
    if (!window.confirm('Are you sure you want to release this server?')) {
      return;
    }

    try {
      await axios.post(`/admin/servers/${serverId}/release`);
      setMessage('Server released successfully!');
      await fetchServers();
      await fetchUsers();
    } catch (error) {
      setError('Failed to release server');
    }
  };

  const handleAddCoins = async (userId) => {
    const amount = prompt('Enter amount of coins to add:');
    if (!amount || isNaN(amount)) return;

    try {
      await axios.post(`/admin/users/${userId}/coins`, { amount: parseInt(amount) });
      setMessage(`Added ${amount} coins successfully!`);
      await fetchUsers();
    } catch (error) {
      setError('Failed to add coins');
    }
  };

  return (
    <div className="admin-panel">
      <nav className="navbar">
        <div className="nav-content">
          <div className="nav-logo">
            <span className="logo">🐞</span>
            <span>Ladybug Bot Hosting - Admin Panel</span>
          </div>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="admin-container">
        <div className="admin-header">
          <h1>Admin Dashboard</h1>
          <p>Welcome, {user.username}</p>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        {/* Servers Section */}
        <div className="admin-section">
          <div className="section-header">
            <h2>Server Management</h2>
            <button 
              onClick={() => setShowAddServer(!showAddServer)} 
              className="btn-primary"
            >
              {showAddServer ? 'Cancel' : '+ Add Server'}
            </button>
          </div>

          {showAddServer && (
            <div className="add-server-form">
              <form onSubmit={handleAddServer}>
                <div className="form-group">
                  <label>Server Name:</label>
                  <input
                    type="text"
                    value={newServer.serverName}
                    onChange={(e) => setNewServer({...newServer, serverName: e.target.value})}
                    placeholder="e.g., Server 1"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Silly Hosting URL:</label>
                  <input
                    type="url"
                    value={newServer.sillyHostingUrl}
                    onChange={(e) => setNewServer({...newServer, sillyHostingUrl: e.target.value})}
                    placeholder="https://client.sillydev.co.uk/..."
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Silly Hosting Username:</label>
                  <input
                    type="text"
                    value={newServer.sillyUsername}
                    onChange={(e) => setNewServer({...newServer, sillyUsername: e.target.value})}
                    placeholder="Username"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Silly Hosting Password:</label>
                  <input
                    type="password"
                    value={newServer.sillyPassword}
                    onChange={(e) => setNewServer({...newServer, sillyPassword: e.target.value})}
                    placeholder="Password"
                    required
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Server'}
                </button>
              </form>
            </div>
          )}

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Server Name</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>User Coins</th>
                  <th>Assigned At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((server) => (
                  <tr key={server._id}>
                    <td>{server.serverName}</td>
                    <td>
                      <span className={`badge ${server.status}`}>
                        {server.status}
                      </span>
                    </td>
                    <td>
                      {server.userId ? server.userId.username : 'None'}
                    </td>
                    <td>
                      {server.userId ? `${server.userId.coins} 🪙` : '-'}
                    </td>
                    <td>
                      {server.assignedAt ? new Date(server.assignedAt).toLocaleString() : '-'}
                    </td>
                    <td>
                      {server.status === 'active' && (
                        <button 
                          onClick={() => handleReleaseServer(server._id)}
                          className="btn-warning btn-sm"
                        >
                          Release
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteServer(server._id)}
                        className="btn-danger btn-sm"
                      >
                        Delete
                      </button>
                    </td>
