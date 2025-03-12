//Image/auth-service/server.js

import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
app.use(express.json());

// 미들웨어: 모든 요청을 로깅
app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

// Google OAuth 라우트 불러오기
import googleRoutes from './routes/google.js';
app.use('/api/google', googleRoutes);

// 🟢 Liveness Probe: 항상 200 OK 반환
app.get('/healthz', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Auth Liveness: `);
  res.status(200).send('Auth OK');
  console.log(`${new Date().toISOString()} - 🔹 Auth Liveness: OK ✅\n`);

});

// 🟢 Readiness Probe: 애플리케이션이 특정 리소스(예: 환경 변수)를 정상적으로 읽을 수 있는지 확인
app.get('/ready', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Auth Readiness: `);
  if (process.env.GOOGLE_CLIENT_ID && process.env.JWT_SECRET) {
    res.status(200).send('Auth READY');
    console.log(`${new Date().toISOString()} - 🔹 Auth Readiness: READY 😋\n`);
  } else {
    res.status(503).send('Auth NOT READY');
    console.log(`${new Date().toISOString()} - 🔹 Auth Readiness: NOT READY 💀\n`);
  }
});

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI, {/* 옵션 */ })
  .then(() => console.log('MongoDB connected (Auth Service)'))
  .catch(err => console.error('MongoDB connection error:', err));


// 실제 포트가 3001이라면 아래처럼
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth Service running on port ${PORT}`);
});


// SonarQube Bug Test
// 의도적 오타: a = 5 (단순 대입) 대신 === 등 비교연산자 써야 함
function alwaysTrue(a) {
  if (a = 5) { // SonarQube가 "조건문이 항상 참" 또는 "오타"로 버그 감지
    return "Always runs";
  }
  return "Never runs";
}