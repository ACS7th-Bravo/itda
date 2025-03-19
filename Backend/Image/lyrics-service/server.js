//Image/lyrics-service/server.js

import express from 'express';
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';  // DynamoDB 클라이언트를 사용하기 위한 import 추가
import { createClient } from 'redis'; // Redis 클라이언트 import 추가

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

const LRCLIB_API_BASE = readSecret('lrclib_api_base');
const MUSIXMATCH_API_KEY = readSecret('musixmatch_api_key');
const MUSIXMATCH_API_HOST = readSecret('musixmatch_api_host');
const AWS_REGION_DYNAMODB = readSecret('aws_region_dynamodb');
const AWS_ACCESS_KEY_ID = readSecret('aws_access_key_id');
const AWS_SECRET_ACCESS_KEY = readSecret('aws_secret_access_key');
const DYNAMODB_TABLE_TRACKS = readSecret('dynamo_table_tracks');
const REDIS_URL = readSecret('redis_url');
const PORT = 3003;



// CHANGE: DynamoDB DocumentClient 생성 (MongoDB 대신 사용)
const dynamoDb = new AWS.DynamoDB.DocumentClient({
  region: AWS_REGION_DYNAMODB,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

// Redis 클라이언트 설정 (기존과 동일)
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', err => console.error('Redis Client Error', err));
await redisClient.connect();

// 미들웨어: 모든 요청을 로깅
app.use((req, res, next) => {
  // console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

import lyricsRoutes from './routes/lyrics.js';
app.use('/api/lyrics', lyricsRoutes);

// 🟢 Liveness Probe: 항상 200 OK 반환
app.get('/healthz', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Lyrics Liveness: `);
  res.status(200).send('Lyrics OK');
  console.log(`${new Date().toISOString()} - 🔹 Lyrics Liveness: OK ✅\n`);

});

// 🟢 Readiness Probe: 애플리케이션이 특정 리소스(예: 환경 변수)를 정상적으로 읽을 수 있는지 확인
app.get('/ready', (req, res) => {
  console.log(`${new Date().toISOString()} - 🔹 Lyrics Readiness: `);
  if (LRCLIB_API_BASE && MUSIXMATCH_API_KEY && AWS_REGION_DYNAMODB && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && DYNAMODB_TABLE_TRACKS) {
    res.status(200).send('Lyrics READY');
    console.log(`${new Date().toISOString()} - 🔹 Lyrics Readiness: READY 😋\n`);
  } else {
    res.status(503).send('Lyrics NOT READY');
    console.log(`${new Date().toISOString()} - 🔹 Lyrics Readiness: NOT READY 💀\n`);
  }
});





app.listen(PORT, () => {
  console.log(`✅ [Lyrics Service] 서버가 포트 ${PORT}에서 실행 중`);
  console.log(`🔹 Using DynamoDB table: ${DYNAMODB_TABLE_TRACKS || 'dynamo_tracks'}`);
  try {
    const region = AWS_REGION_DYNAMODB;
    console.log(`🔹 AWS Region: ${region}`);
  } catch (error) {
    console.log('🔹 AWS Region: Unknown');
  }
  // Redis 연결 상태 확인: ping 호출
  redisClient.ping().then(ping => {
    console.log(`🔹 Redis ping: ${ping}`);
  }).catch(err => {
    console.error(`❌ Redis ping failed: ${err}`);
  });
  
});
