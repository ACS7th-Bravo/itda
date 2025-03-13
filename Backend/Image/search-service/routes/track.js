import express from 'express';
import AWS from 'aws-sdk';  // DynamoDB 클라이언트를 사용하기 위한 import 추가
import fs from 'fs';
import path from 'path';
import { createClient } from 'redis'; // Redis 클라이언트 import 추가

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

// DynamoDB 및 Redis URI 불러오기
const REDIS_URL = readSecret('redis_url');
const AWS_REGION_DYNAMODB = readSecret('aws_region_dynamodb');
const AWS_ACCESS_KEY_ID = readSecret('aws_access_key_id');
const AWS_SECRET_ACCESS_KEY = readSecret('aws_secret_access_key');
const DYNAMODB_TABLE_TRACKS = readSecret('dynamodb_table_tracks');

// 🔹 Redis 클라이언트 설정
const redis = createClient({
  url: REDIS_URL
});

redis.on('error', err => console.error('Redis Client Error', err));
await redis.connect();

// 🔹 DynamoDB 클라이언트 설정
const dynamoDb = new AWS.DynamoDB.DocumentClient({
  region: AWS_REGION_DYNAMODB,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

// 🔹 Redis 캐시 설정
const REDIS_CACHE_TTL = 60 * 60 * 24; // 24시간
const REDIS_KEY_PREFIX = 'track:youtube:';

const router = express.Router();

// POST 요청: 트랙 데이터 저장
router.post('/', async (req, res) => {
  try {
    const {
      track_id,
      track_name,
      artist_id,
      artist_name,
      album_id,
      album_image,
      plain_lyrics,
      parsed_lyrics,
      lyrics_translation,
      streaming_id,
    } = req.body;

    // DynamoDB에 트랙 정보 저장
    const params = {
      TableName: DYNAMODB_TABLE_TRACKS,
      Item: {
        track_id,
        track_name,
        artist_id,
        artist_name,
        album_id,
        album_image,
        plain_lyrics,
        parsed_lyrics,
        lyrics_translation,
        streaming_id,
      },
    };

    // DynamoDB에 저장
    await dynamoDb.put(params).promise();

    // 데이터 저장 성공 로그
    console.log(`✅ DynamoDB에 트랙이 저장되었습니다: ${track_id} - ${track_name}`);

    // 🔹 Redis에 YouTube ID 캐싱
    if (streaming_id && track_id) {
      try {
        const redisKey = REDIS_KEY_PREFIX + track_id;
        const existingValue = await redis.get(redisKey);

        if (!existingValue) {
          await redis.set(redisKey, streaming_id, 'EX', REDIS_CACHE_TTL);
          console.log(`✅ ${track_name} - YouTube ID를 Redis에 캐싱했습니다: ${streaming_id}`);
        } else if (existingValue !== streaming_id) {
          await redis.set(redisKey, streaming_id, 'EX', REDIS_CACHE_TTL);
          console.log(`🔄 ${track_name} - Redis의 YouTube ID를 업데이트했습니다: ${streaming_id}`);
        } else {
          console.log(`ℹ️ ${track_name} - 이미 Redis에 동일한 YouTube ID가 캐싱되어 있습니다.`);
        }
      } catch (redisErr) {
        console.error("⚠️ Redis 캐싱 중 오류 발생:", redisErr);
      }
    }

    res.status(200).json({ message: 'Track saved successfully' });
  } catch (error) {
    console.error('❌ Error saving track:', error);
    res.status(500).json({ message: 'Error saving track' });
  }
});

// GET 요청: 트랙 조회
router.get('/', async (req, res) => {
  const { track_id } = req.query;
  if (!track_id) {
    return res.status(400).json({ error: 'track_id parameter is required' });
  }

  try {
    console.log("🔍 트랙 ID로 YouTube 비디오 ID 검색 중:", track_id);

    // 1️⃣ Redis에서 먼저 확인
    const redisKey = REDIS_KEY_PREFIX + track_id;
    try {
      const cachedVideoId = await redis.get(redisKey);
      if (cachedVideoId) {
        console.log(`✅ ${track_id} - ${track_name} - Redis 캐시에서 YouTube ID를 찾았습니다: ${cachedVideoId}`);
        return res.json({ streaming_id: cachedVideoId });
      } else {
        console.log(`ℹ️ ${track_id} - ${track_name} - Redis에 캐시된 YouTube ID가 없습니다. DB 확인 중...`);
      }
    } catch (redisErr) {
      console.error("⚠️ Redis 접근 중 오류 발생:", redisErr);
    }

    // 2️⃣ DynamoDB에서 해당 트랙 조회
    const params = {
      TableName: DYNAMODB_TABLE_TRACKS,
      Key: {
        track_id, // track_id로 조회
      },
    };

    try {
      const data = await dynamoDb.get(params).promise();

      if (data.Item && data.Item.streaming_id) {
        console.log(`✅ ${track_id} - ${data.Item.track_name} - DynamoDB에서 YouTube ID를 찾았습니다: ${data.Item.streaming_id}`);

        // 3️⃣ Redis에 캐시
        try {
          await redis.set(redisKey, data.Item.streaming_id, 'EX', REDIS_CACHE_TTL);
          console.log(`✅ ${track_id} - ${data.Item.track_name} - DynamoDB의 YouTube ID를 Redis에 캐싱했습니다.`);
        } catch (redisErr) {
          console.error("⚠️ Redis 캐싱 중 오류 발생:", redisErr);
        }

        return res.json({ streaming_id: data.Item.streaming_id });
      } else {
        console.log(`❌ ${track_id} - 트랙 이름을 찾을 수 없습니다. 클라이언트는 youtube.js API를 호출해야 합니다.`);
        return res.status(404).json({ error: 'Track not found' });
      }
    } catch (dbErr) {
      console.error("⚠️ DynamoDB 조회 오류:", dbErr);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } catch (error) {
    console.error('❌ Error fetching track:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
