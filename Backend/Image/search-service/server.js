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
  //console.log(`${new Date().toISOString()} - 🔹 Search Liveness: `);
  res.status(200).send('Search OK');
  //console.log(`${new Date().toISOString()} - 🔹 Search Liveness: OK ✅\n`);
});

// 🟢 Readiness Probe: 애플리케이션이 특정 리소스(예: 환경 변수)를 정상적으로 읽을 수 있는지 확인
app.get('/ready', (req, res) => {
  //console.log(`${new Date().toISOString()} - 🔹 Search Readiness: `);
  if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && YOUTUBE_API_KEYS && REDIS_URL) {
    res.status(200).send('Search READY');
    //console.log(`${new Date().toISOString()} - 🔹 Search Readiness: READY 😋\n`);
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

// ===== 추가된 부분 시작 =====
// 각 방의 호스트 소켓 ID를 저장하는 맵
const roomHostMap = new Map(); // roomId -> hostSocketId

// 각 방의 대기 중인 클라이언트(수신 확인을 보내지 않은) 목록
const pendingClientMap = new Map(); // roomId -> Set of clientSocketIds
// ===== 추가된 부분 끝 =====

// === 추가: 중복 이벤트 방지를 위한 제한 시간 맵 ===03-24
const eventTimestamps = new Map(); // socketId -> { eventType: timestamp }
// === 추가 끝 ===03-24

// Socket.IO 통합 시작
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on('connection', (socket) => {
  console.log(`새 클라이언트 연결: ${socket.id}`);

  // === 추가: 소켓별 이벤트 타임스탬프 초기화 ===03-24
  eventTimestamps.set(socket.id, {});
  // === 추가 끝 ===03-24

  // ===== 수정된 부분 시작 =====
  socket.on('joinRoom', async (data) => {
    // === 추가: 입력 유효성 검사 ===03-24
    if (!data || !data.roomId) {
      console.log(`❌ 유효하지 않은 joinRoom 요청: ${JSON.stringify(data)}`);
      return;
    }
    // === 추가 끝 ===03-24
    const roomId = data.roomId.trim();
    console.log(`📢 클라이언트 ${socket.id}가 방 ${roomId} 참여 시도중...`);

    // === 추가: 이미 방에 참여 중인지 확인 ===03-24
    if (socket.rooms.has(roomId)) {
      console.log(`ℹ️ 클라이언트 ${socket.id}는 이미 방 ${roomId}에 참여 중입니다.`);
      socket.emit('roomJoined', { roomId });
      return;
    }
    // === 추가 끝 ===03-24

    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
    
    // 클라이언트에게 방에 참여했다고 응답
    socket.emit('roomJoined', { roomId });
    console.log(`현재 roomHostMap:`, Array.from(roomHostMap.entries()));


    // 해당 방의 호스트가 있는지 확인
    const hostSocketId = roomHostMap.get(roomId);
    
    if (hostSocketId) {
      // === 추가: 호스트 소켓이 실제로 연결되어 있는지 확인 ===
      const hostSocket = io.sockets.sockets.get(hostSocketId);
      if (hostSocket) {
      // === 추가 끝 ===
        console.log(`📣 방 ${roomId}의 호스트 ${hostSocketId}에게 클라이언트 참여 알림 전송`);

        // 호스트에게 새로운 클라이언트가 참여했음을 알림
        io.to(hostSocketId).emit('clientJoined', { 
          clientId: socket.id,
          roomId: roomId
        });
        
        // 이 클라이언트를 대기 목록에 추가
        if (!pendingClientMap.has(roomId)) {
          pendingClientMap.set(roomId, new Set());
        }
        pendingClientMap.get(roomId).add(socket.id);
        
        console.log(`🔄 클라이언트 ${socket.id}가 방 ${roomId}에 참여, 호스트 ${hostSocketId}에게 알림`);
      } else {
        console.log(`⚠️ 호스트 소켓 ${hostSocketId}가 연결되어 있지 않음. Redis 조회로 대체...`);
        fallbackToRedis();
      }
    } else {
      console.log(`⚠️ 방 ${roomId}에 호스트가 없음. Redis에서 세션 정보 조회 시도...`);
      fallbackToRedis();
    }
    
    // === 추가: Redis 폴백 함수 분리 ===
    async function fallbackToRedis() {
      try {
        const userEmail = await app.locals.redis.get(`room:${roomId}`);
        if (userEmail) {
          console.log(`✅ Redis에서 userEmail 찾음: ${userEmail}`);
          const sessionData = await app.locals.redis.hGet('liveSessions', userEmail);
          if (sessionData) {
            const parsedSession = JSON.parse(sessionData);
            
            // === 추가: 중복 전송 방지 ===
            const timestamps = eventTimestamps.get(socket.id);
            const now = Date.now();
            if (!timestamps.liveSync || now - timestamps.liveSync > 500) {
              timestamps.liveSync = now;
              // === 추가 끝 ===
              
              socket.emit('liveSync', {
                user: parsedSession.user,
                track: parsedSession.track,
                roomId: roomId,
                initialSync: true
              });
              
              console.log(`🔄 Redis에서 방 ${roomId} 정보 직접 전송`);
            }
          } else {
            console.log(`⚠️ Redis에서 세션 데이터를 찾을 수 없음: ${userEmail}`);
          }
        } else {
          console.log(`⚠️ Redis에서 roomId:${roomId}에 해당하는 userEmail을 찾을 수 없음`);
        }
      } catch (error) {
        console.error(`❌ Redis에서 방 정보 가져오기 실패: ${error.message}`);
      }
    }
    // === 추가 끝 ===
  });

  // 호스트가 클라이언트에게 현재 재생 정보 전송 (초기 또는 재시도)
  socket.on('hostSync', (data) => {
    const { clientId, roomId, track, currentTime } = data;
    
    // === 추가: 중복 전송 방지 ===
    const targetSocket = io.sockets.sockets.get(clientId);
    if (targetSocket) {
      const timestamps = eventTimestamps.get(targetSocket.id) || {};
      const now = Date.now();
      if (!timestamps.hostSync || now - timestamps.hostSync > 500) {
        timestamps.hostSync = now;
    // === 추가 끝 ===

    // 특정 클라이언트에게만 전송
    io.to(clientId).emit('liveSync', {
      track, 
      currentTime,
      roomId,
      initialSync: true // 초기 동기화임을 표시
    });
    
    console.log(`🎵 호스트 ${socket.id}가 클라이언트 ${clientId}에게 초기 동기화 데이터 전송, 현재 시간: ${currentTime}`);
  }
}
  });
  
  // 클라이언트가 동기화 데이터를 수신했다는 확인
  socket.on('syncReceived', (data) => {
    const { roomId } = data;
    
    // 이 클라이언트를 대기 목록에서 제거
    if (pendingClientMap.has(roomId)) {
      pendingClientMap.get(roomId).delete(socket.id);
      console.log(`✅ 클라이언트 ${socket.id}가 동기화 수신 확인, 대기 목록에서 제거`);
    }
  });

  socket.on('liveOn', async (data) => {
    // === 추가: 입력 유효성 검사 ===
    if (!data || !data.user || !data.user.email) {
      console.log('❌ 유효하지 않은 liveOn 요청:', data);
      return;
    }
    // === 추가 끝 ===
    const userEmail = data.user.email.trim().toLowerCase();

    // === 추가: 중복 이벤트 방지 ===
    const timestamps = eventTimestamps.get(socket.id) || {};
    const now = Date.now();
    if (timestamps.liveOn && now - timestamps.liveOn < 5000) {
      return; // 5초 내 중복 요청 무시
    }
    timestamps.liveOn = now;
    // === 추가 끝 ===
    
    // 이미 liveSessions에 있는지 확인
    const existingSession = await app.locals.redis.hGet('liveSessions', userEmail);
    
    // Room ID 확인 또는 생성
    let roomId;
    
    if (existingSession) {
      // 이미 라이브 중이면 기존 roomId 사용
      const parsedSession = JSON.parse(existingSession);
      roomId = parsedSession.roomId;
      
      // 트랙 정보가 변경된 경우에만 업데이트
      if (data.track && data.track.name && 
         (parsedSession.track?.name !== data.track.name || 
          parsedSession.track?.artist !== data.track.artist)) {
        
        // currentTime은 저장하지 않음, 트랙 정보만 업데이트
        parsedSession.track = data.track;
        
        await app.locals.redis.hSet('liveSessions', userEmail, JSON.stringify(parsedSession));
        console.log(`🔄 트랙 정보 업데이트: ${userEmail}, 트랙: ${data.track.name}`);
        
        // 방에 있는 모든 클라이언트에게 동기화 데이터 전송
        io.to(roomId).emit('liveSync', {
          user: data.user,
          track: data.track,
          currentTime: data.currentTime // 소켓 통신에는 currentTime 포함 (기존 기능 유지)
        });
      }
    } else {
      // 새로운 라이브 세션 시작
      roomId = await generateUniqueRoomId(app.locals.redis);
      
      // Redis에 저장할 데이터에서 currentTime 제외
      const sessionData = {
        user: data.user,
        track: data.track,
        roomId
      };
      
      // Redis에 저장
      await app.locals.redis.hSet('liveSessions', userEmail, JSON.stringify(sessionData));
      console.log(`✅ 새 라이브 세션 시작: ${userEmail}, roomId: ${roomId}`);
      
    // roomId와 email 매핑 저장
    await app.locals.redis.set(`room:${roomId}`, userEmail);
      
    // 클라이언트에게 roomId 전달 및 알림
    socket.emit('roomCreated', { roomId });
    }

    
   // ===== 추가된 부분 시작 =====
    // 이 소켓을 해당 방의 호스트로 등록
    roomHostMap.set(roomId, socket.id);
    console.log(`💻 호스트 등록: 방 ${roomId}의 호스트는 ${socket.id}`);
    console.log(`현재 roomHostMap:`, Array.from(roomHostMap.entries()));
    // ===== 추가된 부분 끝 =====
  
  // socket이 아직 방에 join하지 않았으면 join
  if (!socket.rooms.has(roomId)) {
    socket.join(roomId);
  }
  });

  socket.on('liveOff', async (data) => {
    // === 추가: 입력 유효성 검사 ===
    if (!data || !data.user || !data.user.email) {
      console.log('❌ 유효하지 않은 liveOff 요청:', data);
      return;
    }
    // === 추가 끝 ===
    const userEmail = data.user.email.trim().toLowerCase();
    
     // === 추가: 중복 이벤트 방지 ===
     const timestamps = eventTimestamps.get(socket.id) || {};
     const now = Date.now();
     if (timestamps.liveOff && now - timestamps.liveOff < 5000) {
       return; // 5초 내 중복 요청 무시
     }
     timestamps.liveOff = now;
     // === 추가 끝 ===

    // 해당 사용자의 라이브 세션 정보 확인
    const existingSession = await app.locals.redis.hGet('liveSessions', userEmail);
    
    if (existingSession) {
      const parsedSession = JSON.parse(existingSession);
      const roomId = parsedSession.roomId;

      // ===== 추가된 부분 시작 =====
      // 호스트 맵에서 제거
      roomHostMap.delete(roomId);
      // 대기 중인 클라이언트 목록 제거
      pendingClientMap.delete(roomId);
      // ===== 추가된 부분 끝 =====
      
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

  // === 추가: liveUpdate 이벤트 핸들러 ===03-23
socket.on('liveUpdate', async (data) => {
  const { user, track, roomId, currentTime } = data;
  
  if (!roomId) {
    console.log('❌ roomId가 없어 업데이트 불가');
    return;
  }

  // 중복 업데이트 방지
  const timestamps = eventTimestamps.get(socket.id) || {};
  const now = Date.now();
  if (timestamps.liveUpdate && now - timestamps.liveUpdate < 300) {
    return; // 300ms 내 중복 업데이트 무시
  }
  timestamps.liveUpdate = now;
  
  // 방에 있는 모든 클라이언트에게 업데이트 데이터 전송
  io.to(roomId).emit('liveSync', {
    user,
    track,
    currentTime,
    initialSync: false // 초기 동기화가 아닌 업데이트임
  });
  
  console.log(`🔄 방 ${roomId}에 라이브 업데이트 전송, 트랙: ${track.name}`);
  
  // Redis에 트랙 정보 업데이트
  try {
    const userEmail = user.email.trim().toLowerCase();
    const existingSession = await app.locals.redis.hGet('liveSessions', userEmail);
    
    if (existingSession) {
      const parsedSession = JSON.parse(existingSession);
      parsedSession.track = track;
      
      await app.locals.redis.hSet('liveSessions', userEmail, JSON.stringify(parsedSession));
      console.log(`✅ Redis에 트랙 정보 업데이트: ${userEmail}, 트랙: ${track.name}`);
    }
  } catch (error) {
    console.error(`❌ Redis 업데이트 실패: ${error.message}`);
  }
});
// === 추가 끝 ===03-23

// === 추가: 재생 상태 변경 이벤트 핸들러 ===
socket.on('playStateChanged', (data) => {
  const { isPaused, roomId } = data;
  
  if (!roomId) {
    console.log('❌ roomId가 없어 상태 변경 불가');
    return;
  }

  // 중복 상태 변경 방지
  const timestamps = eventTimestamps.get(socket.id) || {};
  const now = Date.now();
  if (timestamps.playStateChanged && now - timestamps.playStateChanged < 300) {
    return; // 300ms 내 중복 상태 변경 무시
  }
  timestamps.playStateChanged = now;
  
  // 방에 있는 모든 클라이언트에게 재생 상태 전송
  io.to(roomId).emit('playStateUpdate', {
    isPaused
  });
  
  console.log(`🎮 방 ${roomId}에 재생 상태 변경 전송: ${isPaused ? '일시정지' : '재생'}`);
});
// === 추가 끝 ===

// === 추가: 시간 업데이트 이벤트 핸들러 ===
socket.on('timeUpdate', (data) => {
  const { currentTime, roomId } = data;
  
  if (!roomId) {
    console.log('❌ roomId가 없어 시간 업데이트 불가');
    return;
  }

  // 중복 시간 업데이트 방지
  const timestamps = eventTimestamps.get(socket.id) || {};
  const now = Date.now();
  if (timestamps.timeUpdate && now - timestamps.timeUpdate < 300) {
    return; // 300ms 내 중복 시간 업데이트 무시
  }
  timestamps.timeUpdate = now;
  
  // 방에 있는 모든 클라이언트에게 시간 업데이트 전송
  io.to(roomId).emit('seekUpdate', {
    currentTime
  });
  
  console.log(`⏱️ 방 ${roomId}에 시간 업데이트 전송: ${currentTime}`);
});
// === 추가 끝 ===

// === 추가: 클라이언트가 라이브 룸을 나가는 이벤트 핸들러 ===
socket.on('leaveLiveRoom', (data) => {
  const { roomId } = data;
  
  if (roomId) {
    socket.leave(roomId);
    console.log(`👋 클라이언트 ${socket.id}가 방 ${roomId}에서 나감`);
  }
});
// === 추가 끝 ===03-23

  socket.on('disconnect', () => {
    console.log(`클라이언트 연결 해제: ${socket.id}`);

    // === 추가: 이벤트 타임스탬프 맵에서 제거 ===
    eventTimestamps.delete(socket.id);
    // === 추가 끝 ===

    // ===== 추가된 부분 시작 =====
    // 연결 해제된 소켓이 호스트인 경우 처리
    // roomHostMap에서 이 소켓이 호스트인 방 찾기
    let hostRoomId = null;
    for (const [roomId, hostSocketId] of roomHostMap.entries()) {
      if (hostSocketId === socket.id) {
        hostRoomId = roomId;
        
        roomHostMap.delete(roomId);
        console.log(`🔴 호스트 ${socket.id} 연결 해제: 방 ${roomId}`);
        // 해당 방의 모든 클라이언트에게 라이브 종료 알림
        io.to(roomId).emit('liveSync', { track: null, currentTime: 0 });

         // Redis에서 정보 삭제 (비동기 작업)
        (async () => {
          try {
            const userEmail = await app.locals.redis.get(`room:${roomId}`);
            if (userEmail) {
              await app.locals.redis.hDel('liveSessions', userEmail);
              await app.locals.redis.del(`room:${roomId}`);
              console.log(`❌ 호스트 연결 해제로 인한 라이브 세션 종료: ${userEmail}, roomId: ${roomId}`);
            }
          } catch (error) {
            console.error(`❌ Redis 삭제 실패: ${error.message}`);
          }
        })();
        
        break;
      }
    }
    
    // 연결 해제된 소켓이 대기 중인 클라이언트인 경우 처리
    for (const [roomId, clientSet] of pendingClientMap.entries()) {
      if (clientSet.has(socket.id)) {
        clientSet.delete(socket.id);
        console.log(`🔴 대기 중인 클라이언트 ${socket.id} 연결 해제: 방 ${roomId}`);
      }
    }

  });
});







server.listen(PORT, () => {
  console.log(`Socket.IO 기능이 포함된 백엔드가 포트 ${PORT}에서 실행 중`);
});