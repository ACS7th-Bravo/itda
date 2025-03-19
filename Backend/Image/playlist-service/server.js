import express from 'express';
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

// AWS 관련 시크릿 값들 읽어오기
const AWS_REGION_DYNAMODB = readSecret('aws_region_dynamodb');
const AWS_ACCESS_KEY_ID = readSecret('aws_access_key_id');
const AWS_SECRET_ACCESS_KEY = readSecret('aws_secret_access_key');
const DYNAMODB_TABLE_PLAYLISTS = readSecret('dynamodb_table_playlists');
const DYNAMODB_TABLE_USERS = readSecret('dynamodb_table_users');

// 포트 고정 및 서버 설정
const PORT = 3005;
const app = express();
app.use(express.json());

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  // console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

// 플레이리스트 라우터 추가
import playlistRouter from './routes/playlist.js';
app.use('/api/playlist', playlistRouter);

// 🟢 Liveness Probe: 항상 200 OK 반환
app.get('/healthz', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Playlist Liveness: `);
  res.status(200).send('Playlist OK');
  console.log(`${new Date().toISOString()} - 🔹 Playlist Liveness: OK ✅\n`);
});

// 🟢 Readiness Probe: 시크릿 값들이 정상적으로 로드되었는지 확인
app.get('/ready', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Playlist Readiness: `);

  // AWS 시크릿 값들이 정상적으로 로드되었는지 확인
  if (!AWS_REGION_DYNAMODB || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !DYNAMODB_TABLE_PLAYLISTS || !DYNAMODB_TABLE_USERS) {
    res.status(503).send('Playlist NOT READY');
    console.log(`${new Date().toISOString()} - 🔹 Playlist Readiness: NOT READY 💀\n`);
  } else {
    res.status(200).send('Playlist READY');
    console.log(`${new Date().toISOString()} - 🔹 Playlist Readiness: READY 😋\n`);
  }
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`✅ [Playlist Service] 서버가 포트 ${PORT}에서 실행 중`);
});
