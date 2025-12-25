const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['avatar', 'banner', 'profile'],
    required: true
  },
  category: {
    type: String,
    enum: ['boy', 'girl', 'anime'],
    required: true
  },
  data: {
    type: Buffer,
    required: true
  },
  uploadedBy: {
    type: String,
    default: 'system'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Image', ImageSchema);
