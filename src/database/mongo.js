const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error('❌ MONGO_URI غير موجود في ملف .env');
}

async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

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
  image: {
    type: Buffer,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ImageModel = mongoose.model('images', ImageSchema);

module.exports = {
  connectMongo,
  ImageModel
};
