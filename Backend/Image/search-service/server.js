//Image/search-service/server.js

import express from 'express';
// **수정**: Removed mongoose import (MongoDB not used anymore)
// import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

// 🔹 AWS Secrets Manager에서 환경 변수 읽는 함수
function readSecret(secretName) {
  const secretPath = path.join('/mnt/secrets-store', secretName);
  try {
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch (err) {
    console.error(`❌ Error reading secret ${secretName} from ${secretPath}:`, err);
    throw err;
  }
}

// 기존 AWS Secrets Manager에서 필요한 환경 변수 불러오기
const SPOTIFY_CLIENT_ID = readSecret('spotify_client_id');
const SPOTIFY_CLIENT_SECRET = readSecret('spotify_client_secret');
const YOUTUBE_API_KEYS = readSecret('youtube_api_keys');
// **수정**: Removed MONGO_URI as MongoDB is no longer used
// const MONGO_URI = readSecret('mongo_uri');
const REDIS_URL = readSecret('redis_url'); 
const PORT = 3002;

// 라우트 연결
import spotifyRouter from './routes/spotify.js';
import youtubeRouter from './routes/youtube.js';
import trackRouter from './routes/track.js';

app.use('/api/spotify', spotifyRouter);
app.use('/api/youtube', youtubeRouter);
app.use('/api/track', trackRouter);

// 🟢 Liveness
app.get('/healthz', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Search Liveness: `);
  res.status(200).send('Search OK');
  console.log(`${new Date().toISOString()} - 🔹 Search Liveness: OK ✅\n`);

});

// 🟢 Readiness
app.get('/ready', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Search Readiness: `);
  if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && YOUTUBE_API_KEYS && REDIS_URL) {
    res.status(200).send('Search READY');
    console.log(`${new Date().toISOString()} - 🔹 Search Readiness: READY 😋\n`);
  } else {
    res.status(503).send('Search NOT READY');
    console.log(`${new Date().toISOString()} - 🔹 Search Readiness: NOT READY 💀\n`);
  }
});


app.listen(PORT, () => {
  console.log(`Search Service running on port ${PORT}`);
});
