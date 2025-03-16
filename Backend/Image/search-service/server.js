// server.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';                   // 추가
import { Server } from 'socket.io';        // 추가

const app = express();
app.use(express.json());

// Secrets Manager에서 환경 변수 읽어오기 함수 (변경 없음)
function readSecret(secretName) {
  const secretPath = path.join('/mnt/secrets-store', secretName);
  try {
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch (err) {
    console.error(`❌ Error reading secret ${secretName} from ${secretPath}:`, err);
    throw err;
  }
}

// 🔹 Secrets에서 값 가져오기
const SPOTIFY_CLIENT_ID = readSecret('spotify_client_id');
const SPOTIFY_CLIENT_SECRET = readSecret('spotify_client_secret');
const YOUTUBE_API_KEYS = readSecret('youtube_api_keys');
const REDIS_URL = readSecret('redis_url'); 
// [변경] MONGO_URI 제거 (DynamoDB를 사용)
const PORT = 3002;



// 🔹 라우트 연결
import spotifyRouter from './routes/spotify.js';
import youtubeRouter from './routes/youtube.js';
import trackRouter from './routes/track.js';

app.use('/api/spotify', spotifyRouter);
app.use('/api/youtube', youtubeRouter);
app.use('/api/track', trackRouter);

// 🔹 Liveness Probe
app.get('/healthz', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Search Liveness: `);
  res.status(200).send('Search OK');
  console.log(`${new Date().toISOString()} - 🔹 Search Liveness: OK ✅\n`);
});

// 🟢 Readiness Probe: 애플리케이션이 특정 리소스(예: 환경 변수)를 정상적으로 읽을 수 있는지 확인
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

// ===== 여기서부터 Socket.IO 통합 =====
// HTTP 서버 생성 (app 대신)
const server = http.createServer(app);

// Socket.IO 서버 생성 (CORS 설정 포함)
const io = new Server(server, {
  cors: {
    origin: "*",  // 실제 운영환경에서는 도메인을 제한하세요.
  }
});

// Socket.IO 연결 시, 각 클라이언트를 유저 이메일(room ID) 기준으로 분리
io.on('connection', (socket) => {
  console.log(`새 클라이언트 연결: ${socket.id}`);
  
  socket.on('liveOn', (data) => {
    const roomId = data.user.email;  // 분리 기준: 유저 이메일
    socket.join(roomId);
    console.log(`라이브 시작 요청 from ${data.user.email} - room: ${roomId}`, data);
    // 해당 room에 있는 클라이언트에게만 liveSync 이벤트 전송
    io.to(roomId).emit('liveSync', data);
  });

  socket.on('liveOff', (data) => {
    const roomId = data.user.email;
    console.log(`라이브 종료 요청 from ${data.user.email} - room: ${roomId}`);
    io.to(roomId).emit('liveSync', { user: data.user, track: null, currentTime: 0 });
    socket.leave(roomId);
  });

  socket.on('disconnect', () => {
    console.log(`클라이언트 연결 해제: ${socket.id}`);
  });
});
// ===== Socket.IO 통합 끝 =====

// 기존 app.listen() 대신 server.listen() 사용
server.listen(PORT, () => {
  console.log(`Socket.IO 기능이 포함된 백엔드가 포트 ${PORT}에서 실행 중`);
});