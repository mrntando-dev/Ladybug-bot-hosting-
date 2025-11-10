const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const adminRoutes = require('./routes/admin');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ladybug-hosting', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Ladybug Bot Hosting API' });
});

// Coin deduction and server reallocation (runs every hour)
cron.schedule('0 * * * *', async () => {
  const Server = require('./models/Server');
  const User = require('./models/User');
  
  try {
    const activeServers = await Server.find({ status: 'active' }).populate('userId');
    
    for (let server of activeServers) {
      if (server.userId) {
        const user = await User.findById(server.userId);
        
        if (user.coins <= 0) {
          // User has no coins, free up the server
          server.userId = null;
          server.status = 'available';
          await server.save();
          
          // Find user with most coins waiting for a server
          const waitingUser = await User.findOne({ 
            hasActiveServer: false 
          }).sort({ coins: -1 });
          
          if (waitingUser && waitingUser.coins > 0) {
            server.userId = waitingUser._id;
            server.status = 'active';
            server.assignedAt = new Date();
            await server.save();
            
            waitingUser.hasActiveServer = true;
            await waitingUser.save();
          }
        } else {
          // Deduct 1 coin per hour
          user.coins -= 1;
          await user.save();
        }
      }
    }
  } catch (error) {
    console.error('Cron job error:', error);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
