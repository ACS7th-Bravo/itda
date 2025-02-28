//Image/search-service/server.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// DB 연결 (필요하다면)
mongoose.connect(process.env.MONGO_URI, {})
  .then(() => console.log('Search DB connected'))
  .catch(err => console.error(err));

// 라우트 연결
import spotifyRouter from './routes/spotify.js';
import youtubeRouter from './routes/youtube.js';
import trackRouter from './routes/track.js';  // [추가]

app.use('/api/spotify', spotifyRouter);
app.use('/api/youtube', youtubeRouter);
app.use('/api/track', trackRouter);  // [추가]

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Search Service running on port ${PORT}`);
});
