require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Import Routes
const productRoutes = require('./routes/products');
const walletRoutes = require('./routes/wallet');
const escrowRoutes = require('./routes/escrowRoutes');
const app = express();

// อนุญาตให้ Next.js เรียกใช้งาน API ได้
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/my_store_db';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Successfully'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));


// Mount API Path
app.use('/api/products', productRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/escrow', escrowRoutes);

console.log('👉 Escrow Route Loaded Successfully!');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));