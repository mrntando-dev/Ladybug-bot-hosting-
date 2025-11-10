const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
  serverName: {
    type: String,
    required: true
  },
  sillyHostingUrl: {
    type: String,
    required: true
  },
  sillyUsername: {
    type: String,
    required: true
  },
  sillyPassword: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['available', 'active'],
    default: 'available'
  },
  assignedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Server', serverSchema);
