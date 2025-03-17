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

  // server.js - liveOn 이벤트 핸들러 수정
socket.on('liveOn', async (data) => {
  const roomId = data.user.email.trim().toLowerCase();
  socket.join(roomId);
  console.log(`🎤 라이브 시작 요청 from ${data.user.email} - room: ${roomId}`);

  // 디버깅을 위한 로그 추가
  if (data.track) {
      console.log(`🎤 호스트 트랙 정보:`, {
          track_name: data.track.name,
          artist: data.track.artist,
          streaming_id: data.track.streaming_id
      });
  }

  // Redis에 전체 트랙 정보 저장
  await app.locals.redis.hSet('liveSessions', roomId, JSON.stringify({
      user: data.user,
      track: data.track,
      currentTime: data.currentTime
  }));

  console.log(`✅ Redis에 라이브 유저 정보 저장: ${roomId}`);

  // 클라이언트에게 실시간으로 곡 정보 전송
  io.to(roomId).emit('liveSync', data);
});

socket.on('liveOff', async (data) => {
  if (!data || !data.user || !data.user.email) {
      console.error('❌ 잘못된 liveOff 요청 데이터:', data);
      return;
  }
  
  const roomId = data.user.email.trim().toLowerCase();
  console.log(`🔴 라이브 종료 요청 from ${data.user.email} - room: ${roomId}`);
  
  try {
      await app.locals.redis.hDel('liveSessions', roomId);
      console.log(`✅ Redis 삭제: liveSessions[${roomId}] 삭제됨`);
      
      // 방에 있는 모든 사용자에게 라이브 종료 알림
      io.to(roomId).emit('liveSync', { 
          user: data.user, 
          track: null,
          liveEnded: true 
      });
      
      socket.leave(roomId);
      console.log(`👋 방 나감: ${roomId}`);
  } catch (error) {
      console.error(`❌ liveOff 처리 중 오류:`, error);
  }
});

  socket.on('disconnect', () => {
      console.log(`클라이언트 연결 해제: ${socket.id}`);
  });

// server.js - requestCurrentTrack 핸들러 수정
socket.on('requestCurrentTrack', async (data) => {
  try {
      const roomId = data.roomId.trim().toLowerCase();
      console.log(`🎵 클라이언트가 현재 트랙 정보 요청: ${roomId}`);
      
      // Redis에서 해당 룸의 라이브 세션 정보 조회
      const sessionData = await redis.hGet('liveSessions', roomId);
      
      if (sessionData) {
          const parsedData = JSON.parse(sessionData);
          
          // 디버깅을 위한 로그 추가
          console.log(`🎵 트랙 정보 전송 전 검증:`, {
              track_name: parsedData.track?.name,
              artist: parsedData.track?.artist,
              streaming_id: parsedData.track?.streaming_id
          });
          
          // streaming_id가 없는 경우 처리할 수 있는 로직 추가
          if (parsedData.track && !parsedData.track.streaming_id && parsedData.track.id) {
              parsedData.track.streaming_id = parsedData.track.id;
              console.log(`🛠️ streaming_id 복구: ${parsedData.track.id}`);
          }
          
          // 요청한 클라이언트에게만 현재 트랙 정보 전송
          socket.emit('liveSync', parsedData);
      } else {
          console.log(`❌ 룸 ${roomId}에 대한 라이브 세션 정보 없음`);
          socket.emit('liveSessionNotFound', { roomId });
      }
  } catch (error) {
      console.error(`❌ 트랙 정보 요청 처리 중 오류:`, error);
  }
});
});
// Socket.IO 통합 끝

server.listen(PORT, () => {
  console.log(`Socket.IO 기능이 포함된 백엔드가 포트 ${PORT}에서 실행 중`);
});