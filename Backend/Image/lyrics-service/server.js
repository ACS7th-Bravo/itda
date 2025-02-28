//Image/lyrics-service/server.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ [Lyrics Service] MongoDB 연결 성공');
}).catch(err => {
  console.error('❌ [Lyrics Service] MongoDB 연결 실패:', err);
});

const app = express();
app.use(cors());
app.use(express.json());

import lyricsRoutes from './routes/lyrics.js';
app.use('/api/lyrics', lyricsRoutes);
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`✅ [Lyrics Service] 서버가 포트 ${PORT}에서 실행 중`);
});
