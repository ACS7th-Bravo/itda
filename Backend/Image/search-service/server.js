// server.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';                   
import { Server } from 'socket.io';        
import { createClient } from 'redis'; 
import crypto from 'crypto'; // 추가된 import




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

// UUID 생성 함수 추가
// ===== 추가된 부분 시작 =====
function generateUUID() {
  // Node.js v14.17.0 이상에서는 crypto.randomUUID() 사용 가능
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // 하위 버전 Node.js 지원
  return crypto.randomBytes(16).toString('hex').match(/.{1,8}/g).join('-');
}

// 고유한 roomId 생성 함수
async function generateUniqueRoomId(redis) {
  let roomId;
  let exists = true;
  
  // 고유한 ID가 생성될 때까지 반복
  while(exists) {
    roomId = generateUUID();
    // 이미 존재하는지 확인
    const existsRoom = await redis.exists(`room:${roomId}`);
    exists = existsRoom === 1;
  }
  
  return roomId;
}
// Socket.IO 통합 시작
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on('connection', (socket) => {
  console.log(`새 클라이언트 연결: ${socket.id}`);

  // ===== 수정된 부분 시작 =====
  socket.on('joinRoom', (data) => {
    const roomId = data.roomId.trim();
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
    socket.emit('roomJoined', { roomId }); // 클라이언트에게 응답
  });

  socket.on('liveOn', async (data) => {
    const userEmail = data.user.email.trim().toLowerCase();
    
    // 이미 liveSessions에 있는지 확인
    const existingSession = await app.locals.redis.hGet('liveSessions', userEmail);
    
    // Room ID 확인 또는 생성
    let roomId;
    
    if (existingSession) {
      // 이미 라이브 중이면 기존 roomId 사용
      const parsedSession = JSON.parse(existingSession);
      roomId = parsedSession.roomId;
      
      // 트랙 정보만 업데이트 (이미 라이브 중인 경우)
      if (data.track && data.track.name) {
        parsedSession.track = data.track;
        parsedSession.currentTime = data.currentTime || 0;
        await app.locals.redis.hSet('liveSessions', userEmail, JSON.stringify(parsedSession));
        console.log(`🔄 트랙 정보 업데이트: ${userEmail}, 트랙: ${data.track.name}`);
      }
    } else {
      // 새로운 라이브 세션 시작
      roomId = await generateUniqueRoomId(app.locals.redis);
      
      // roomId를 data에 추가
      const sessionData = {
        ...data,
        roomId
      };
      
      // Redis에 저장
      await app.locals.redis.hSet('liveSessions', userEmail, JSON.stringify(sessionData));
      console.log(`✅ 새 라이브 세션 시작: ${userEmail}, roomId: ${roomId}`);
      
      // roomId와 email 매핑 저장
      await app.locals.redis.set(`room:${roomId}`, userEmail);
    }
    
    // 클라이언트에게 roomId 전달 및 알림
    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
    
    // 방에 있는 모든 클라이언트에게 동기화 데이터 전송
    io.to(roomId).emit('liveSync', data);
  });

  socket.on('liveOff', async (data) => {
    const userEmail = data.user.email.trim().toLowerCase();
    
    // 해당 사용자의 라이브 세션 정보 확인
    const existingSession = await app.locals.redis.hGet('liveSessions', userEmail);
    
    if (existingSession) {
      const parsedSession = JSON.parse(existingSession);
      const roomId = parsedSession.roomId;
      
      // Redis에서 라이브 세션 및 roomId 매핑 삭제
      await app.locals.redis.hDel('liveSessions', userEmail);
      await app.locals.redis.del(`room:${roomId}`);
      
      console.log(`❌ 라이브 세션 종료: ${userEmail}, roomId: ${roomId}`);
      
      // 방의 모든 클라이언트에게 라이브 종료 알림
      io.to(roomId).emit('liveSync', { user: data.user, track: null, currentTime: 0 });
      
      // socket을 방에서 나가게 함
      socket.leave(roomId);
    }
  });
  // ===== 수정된 부분 끝 =====

  socket.on('disconnect', () => {
    console.log(`클라이언트 연결 해제: ${socket.id}`);
  });
});


server.listen(PORT, () => {
  console.log(`Socket.IO 기능이 포함된 백엔드가 포트 ${PORT}에서 실행 중`);
});