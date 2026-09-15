const express = require('express');
const cors = require('cors');

const app = express();

// อนุญาตให้ Next.js เรียกใช้งาน API ได้
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());