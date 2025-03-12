//Image/translation-service/routes/server.js

import express from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

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

// ✅ AWS Secrets Manager에서 필요한 환경 변수 불러오기
const AWS_ACCESS_KEY_ID = readSecret('aws_access_key_id');
const AWS_SECRET_ACCESS_KEY = readSecret('aws_secret_access_key');
const AWS_REGION = readSecret('aws_region');
const INFERENCE_PROFILE_ARN = readSecret('inference_profile_arn');
const MONGO_URI = readSecret('mongo_uri');
const PORT = 3004;



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
  if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_REGION && INFERENCE_PROFILE_ARN && MONGO_URI) {
    res.status(200).send('Translation READY');
    console.log(`${new Date().toISOString()} - 🔹 Translation Readiness: READY 😋\n`);
  } else {
    res.status(503).send('Translation NOT READY');
    console.log(`${new Date().toISOString()} - 🔹 Translation Readiness: NOT READY 💀\n`);
  }
});


mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ [Translation Service] MongoDB 연결 성공');
}).catch(err => {
  console.error('❌ [Translation Service] MongoDB 연결 실패:', err);
});

app.listen(PORT, () => {
  console.log(`✅ [Translation Service] 서버가 포트 ${PORT}에서 실행 중`);
});
