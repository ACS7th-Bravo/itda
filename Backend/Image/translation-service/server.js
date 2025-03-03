//Image/translation-service/routes/server.js

import express from 'express';
// import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

const app = express();
// app.use(cors());
app.use(express.json());


// 미들웨어: 모든 요청을 로깅
app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

import translateRouter from './routes/translate.js';
app.use('/api/translate', translateRouter);

// 🟢 Liveness Probe: 항상 200 OK 반환
app.get('/healthz', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Translation Liveness: `);
  res.status(200).send('Translation OK');
  console.log(`${new Date().toISOString()} - 🔹 Translation Liveness: OK ✅\n`);

});

// 🟢 Readiness Probe: 애플리케이션이 특정 리소스(예: 환경 변수)를 정상적으로 읽을 수 있는지 확인
app.get('/ready', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Translation Readiness: `);
  if ( process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION && process.env.INFERENCE_PROFILE_ARN && process.env.MONGO_URI ) {
    res.status(200).send('Translation READY');
    console.log(`${new Date().toISOString()} - 🔹 Translation Readiness: READY 😋\n`);
  } else {
    res.status(503).send('Translation NOT READY');
    console.log(`${new Date().toISOString()} - 🔹 Translation Readiness: NOT READY 💀\n`);
  }
});


mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ [Translation Service] MongoDB 연결 성공');
}).catch(err => {
  console.error('❌ [Translation Service] MongoDB 연결 실패:', err);
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`✅ [Translation Service] 서버가 포트 ${PORT}에서 실행 중`);
});
