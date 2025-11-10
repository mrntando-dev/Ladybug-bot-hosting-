const express = require('express');
const Server = require('../models/Server');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get user's active server
router.get('/my-server', auth, async (req, res) => {
  try {
    const server = await Server.findOne({ userId: req.user._id, status: 'active' });
    
    if (!server) {
      return res.status(404).json({ error: 'No active server' });
    }

    res.json({
      serverName: server.serverName,
      assignedAt: server.assignedAt,
      // Don't send sensitive silly hosting credentials to users
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Request a free server
router.post('/request', auth, async (req, res) => {
  try {
    // Check if user already has a server
    if (req.user.hasActiveServer) {
      return res.status(400).json({ error: 'You already have an active server' });
    }

    // Check if user has coins
    if (req.user.coins <= 0) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    // Find available server
    const availableServer = await Server.findOne({ status: 'available' });

    if (!availableServer) {
      return res.status(404).json({ error: 'No free servers available at the moment' });
    }

    // Assign server to user
    availableServer.userId = req.user._id;
    availableServer.status = 'active';
    availableServer.assignedAt = new Date();
    await availableServer.save();

    req.user.hasActiveServer = true;
    await req.user.save();

    res.json({
      message: 'Server assigned successfully',
      server: {
        serverName: availableServer.serverName,
        assignedAt: availableServer.assignedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Release server
router.post('/release', auth, async (req, res) => {
  try {
    const server = await Server.findOne({ userId: req.user._id, status: 'active' });

    if (!server) {
      return res.status(404).json({ error: 'No active server to release' });
    }

    server.userId = null;
    server.status = 'available';
    await server.save();

    req.user.hasActiveServer = false;
    await req.user.save();

    res.json({ message: 'Server released successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get server statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const totalServers = await Server.countDocuments();
    const availableServers = await Server.countDocuments({ status: 'available' });
    const activeServers = await Server.countDocuments({ status: 'active' });

    res.json({
      totalServers,
      availableServers,
      activeServers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
