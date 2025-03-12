//Image/lyrics-service/server.js

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

const LRCLIB_API_BASE = readSecret('lrclib_api_base');
const MUSIXMATCH_API_KEY = readSecret('musixmatch_api_key');
const MONGO_URI = readSecret('mongo_uri');
const PORT = 3003;

const app = express();
app.use(express.json());

// 미들웨어: 모든 요청을 로깅
app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

import lyricsRoutes from './routes/lyrics.js';
app.use('/api/lyrics', lyricsRoutes);

// 🟢 Liveness Probe: 항상 200 OK 반환
app.get('/healthz', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Lyrics Liveness: `);
  res.status(200).send('Lyrics OK');
  console.log(`${new Date().toISOString()} - 🔹 Lyrics Liveness: OK ✅\n`);

});

// 🟢 Readiness Probe: 애플리케이션이 특정 리소스(예: 환경 변수)를 정상적으로 읽을 수 있는지 확인
app.get('/ready', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Lyrics Readiness: `);
  if (LRCLIB_API_BASE && MUSIXMATCH_API_KEY && MONGO_URI) {
    res.status(200).send('Lyrics READY');
    console.log(`${new Date().toISOString()} - 🔹 Lyrics Readiness: READY 😋\n`);
  } else {
    res.status(503).send('Lyrics NOT READY');
    console.log(`${new Date().toISOString()} - 🔹 Lyrics Readiness: NOT READY 💀\n`);
  }
});

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ [Lyrics Service] MongoDB 연결 성공');
}).catch(err => {
  console.error('❌ [Lyrics Service] MongoDB 연결 실패:', err);
});



app.listen(PORT, () => {
  console.log(`✅ [Lyrics Service] 서버가 포트 ${PORT}에서 실행 중`);
});
