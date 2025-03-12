//Image/playlist-service/server.js

import express from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

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

const MONGO_URI = readSecret('mongo_uri'); // MongoDB 연결 URI
const PORT = 3005; // 포트 고정

const app = express();
app.use(express.json());

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});


import playlistRouter from './routes/playlist.js';
app.use('/api/playlist', playlistRouter);

// 🟢 Liveness Probe: 항상 200 OK 반환
app.get('/healthz', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Playlist Liveness: `);
  res.status(200).send('Playlist OK');
  console.log(`${new Date().toISOString()} - 🔹 Playlist Liveness: OK ✅\n`);

});

// 🟢 Readiness Probe: 애플리케이션이 특정 리소스(예: 환경 변수)를 정상적으로 읽을 수 있는지 확인
app.get('/ready', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Playlist Readiness: `);
  if (MONGO_URI) {
    res.status(200).send('Playlist READY');
    console.log(`${new Date().toISOString()} - 🔹 Playlist Readiness: READY 😋\n`);
  } else {
    res.status(503).send('Playlist NOT READY');
    console.log(`${new Date().toISOString()} - 🔹 Playlist Readiness: NOT READY 💀\n`);
  }
});

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ [Playlist Service] MongoDB 연결 성공');
}).catch(err => {
  console.error('❌ [Playlist Service] MongoDB 연결 실패:', err);
});


app.listen(PORT, () => {
  console.log(`✅ [Playlist Service] 서버가 포트 ${PORT}에서 실행 중`);
});
