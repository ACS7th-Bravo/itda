
import express from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// secrets 파일에서 값을 읽어오는 함수
function readSecret(secretName) {
  const secretPath = path.join('/mnt/secrets-store', secretName);
  try {
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch (err) {
    console.error(`Error reading secret ${secretName} from ${secretPath}:`, err);
    throw err;
  }
}

const GOOGLE_CLIENT_ID = readSecret('google_client_id');
const GOOGLE_CLIENT_SECRET = readSecret('google_client_secret');
const GOOGLE_REDIRECT_URI = readSecret('google_redirect_uri'); // ex: https://it-da.site/api/google/google-callback
const JWT_SECRET = readSecret('jwt_secret');
const FRONTEND_URL = readSecret('frontend_url'); // ex: https://it-da.site
const MONGO_URI = readSecret('mongo_uri'); // MongoDB 연결 문자열
const PORT = 3001;

const app = express();
app.use(express.json());

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

// 라우터 설정 (예시: Google OAuth 라우트)
import googleRoutes from './routes/google.js';
app.use('/api/google', googleRoutes);

// Liveness Probe
app.get('/healthz', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Auth Liveness: `);
  res.status(200).send('Auth OK');
  console.log(`${new Date().toISOString()} - 🔹 Auth Liveness: OK ✅\n`);
});

// Readiness Probe
app.get('/ready', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Auth Readiness: `);
  if (GOOGLE_CLIENT_ID && JWT_SECRET) {
    res.status(200).send('Auth READY');
    console.log(`${new Date().toISOString()} - 🔹 Auth Readiness: READY 😋\n`);
  } else {
    res.status(503).send('Auth NOT READY');
    console.log(`${new Date().toISOString()} - 🔹 Auth Readiness: NOT READY 💀\n`);
  }
});

// MongoDB 연결
mongoose.connect(MONGO_URI, { /* 옵션들 */ })
  .then(() => console.log('MongoDB connected (Auth Service)'))
  .catch(err => console.error('MongoDB connection error:', err));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth Service running on port ${PORT}`);
});
