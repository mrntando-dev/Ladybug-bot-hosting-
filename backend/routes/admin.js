const express = require('express');
const Server = require('../models/Server');
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// All routes require authentication and admin privileges
router.use(auth, admin);

// Add new server
router.post('/servers', async (req, res) => {
  try {
    const { serverName, sillyHostingUrl, sillyUsername, sillyPassword } = req.body;

    const server = new Server({
      serverName,
      sillyHostingUrl,
      sillyUsername,
      sillyPassword
    });

    await server.save();
    res.status(201).json({ message: 'Server added successfully', server: { serverName, status: server.status } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all servers with details
router.get('/servers', async (req, res) => {
  try {
    const servers = await Server.find().populate('userId', 'username email coins');
    res.json(servers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete server
router.delete('/servers/:id', async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // If server is assigned, update user
    if (server.userId) {
      await User.findByIdAndUpdate(server.userId, { hasActiveServer: false });
    }

    await Server.findByIdAndDelete(req.params.id);
    res.json({ message: 'Server deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add coins to user
router.post('/users/:id/coins', async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.coins += amount;
    await user.save();

    res.json({ message: 'Coins updated successfully', coins: user.coins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force release server
router.post('/servers/:id/release', async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (server.userId) {
      await User.findByIdAndUpdate(server.userId, { hasActiveServer: false });
    }

    server.userId = null;
    server.status = 'available';
    await server.save();

    res.json({ message: 'Server released successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
