// server.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';                   
import { Server } from 'socket.io';        
import { createClient } from 'redis'; 



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
const PORT = 3002;

const app = express();
app.use(express.json());

// 🔹 Redis 클라이언트 생성 및 연결 (추가)
const redis = createClient({ url: REDIS_URL });
redis.on('error', err => console.error('Redis Client Error', err));
await redis.connect();
app.locals.redis = redis; // 앱 전체에서 사용할 수 있도록 저장




// 🔹 라우트 연결
import spotifyRouter from './routes/spotify.js';
import youtubeRouter from './routes/youtube.js';
import trackRouter from './routes/track.js';
import liveRouter from './routes/live.js'; // 추가

app.use('/api/spotify', spotifyRouter);
app.use('/api/youtube', youtubeRouter);
app.use('/api/track', trackRouter);
app.use('/api/live', liveRouter); // 추가

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

// Socket.IO 통합 시작
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ── 추가된 부분: joinRoom 이벤트 처리 ──
// ── 변경된 부분: joinRoom 이벤트 응답 추가 ──
io.on('connection', (socket) => {
  console.log(`새 클라이언트 연결: ${socket.id}`);

  socket.on('joinRoom', (data) => {
      const roomId = data.roomId.trim().toLowerCase();
      socket.join(roomId);
      console.log(`✅ 클라이언트가 방에 참여함: ${roomId}`);

      // 클라이언트에게 방에 입장했음을 알림
      socket.emit('roomJoined', { roomId });
  });

  socket.on('liveOn', async (data) => {
      const roomId = data.user.email.trim().toLowerCase();
      socket.join(roomId);
      console.log(`🎤 라이브 시작 요청 from ${data.user.email} - room: ${roomId}`, data);

      // Redis에는 유저 정보 및 곡 정보만 저장 (currentTime 저장 ❌)
      await app.locals.redis.hSet('liveSessions', roomId, JSON.stringify({
          user: data.user,
          track: {
              name: data.track.name,
              artist: data.track.artist,
              albumImage: data.track.albumImage
          }
      }));

      console.log(`✅ Redis에 라이브 유저 정보 저장: ${roomId}`);

      // 클라이언트에게 실시간으로 곡 정보 전송 (currentTime 포함)
      io.to(roomId).emit('liveSync', data);
  });

  socket.on('liveOff', async (data) => {
      const roomId = data.user.email.trim().toLowerCase();
      console.log(`라이브 종료 요청 from ${data.user.email} - room: ${roomId}`);
      await app.locals.redis.hDel('liveSessions', roomId);
      console.log(`❌ Redis 삭제: liveSessions[${roomId}] 삭제됨`);
      io.to(roomId).emit('liveSync', { user: data.user, track: null });
      socket.leave(roomId);
  });

  socket.on('disconnect', () => {
      console.log(`클라이언트 연결 해제: ${socket.id}`);
  });
});
// Socket.IO 통합 끝

server.listen(PORT, () => {
  console.log(`Socket.IO 기능이 포함된 백엔드가 포트 ${PORT}에서 실행 중`);
});