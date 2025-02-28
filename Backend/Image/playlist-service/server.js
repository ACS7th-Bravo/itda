//Image/playlist-service/server.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ [Playlist Service] MongoDB 연결 성공');
}).catch(err => {
  console.error('❌ [Playlist Service] MongoDB 연결 실패:', err);
});

const app = express();
app.use(cors());
app.use(express.json());

import playlistRouter from './routes/playlist.js';
app.use('/api/playlist', playlistRouter);

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`✅ [Playlist Service] 서버가 포트 ${PORT}에서 실행 중`);
});
