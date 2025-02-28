//Image/auth-service/server.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Google OAuth 라우트 불러오기
import googleRoutes from './routes/google.js';
app.use('/api/google', googleRoutes);

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI, {/* 옵션 */})
  .then(() => console.log('MongoDB connected (Auth Service)'))
  .catch(err => console.error('MongoDB connection error:', err));


// 실제 포트가 3001이라면 아래처럼
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
