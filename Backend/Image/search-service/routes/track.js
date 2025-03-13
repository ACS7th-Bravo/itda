// backend/routes/track.js
import express from 'express';
import { Track } from '../models/Track.js';
import fs from 'fs';
import path from 'path';
import { createClient } from 'redis';


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

// MongoDB URI 불러오기
const REDIS_URL = readSecret('redis_url');
const MONGO_URI = readSecret('mongo_uri');

// 🔹 Redis 클라이언트 설정
const redis = createClient({
  url: REDIS_URL
});

redis.on('error', err => console.error('Redis Client Error', err));
await redis.connect();

// 🔹 Redis 캐시 설정
const REDIS_CACHE_TTL = 60 * 60 * 24; // 24시간
const REDIS_KEY_PREFIX = 'track:youtube:';

const router = express.Router();

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

    // 만약 동일한 track_id가 이미 존재하면 저장하지 않거나 업데이트 처리할 수 있음.
    let track = await Track.findOne({ track_id });
    if (!track) {
      track = new Track({
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
      });
      await track.save();
    }
    // 🔹 Redis에 YouTube ID 캐싱
    if (streaming_id && track_id) {
      try {
        const redisKey = REDIS_KEY_PREFIX + track_id;
        const existingValue = await redis.get(redisKey);
        
        if (!existingValue) {
          await redis.set(redisKey, streaming_id, 'EX', REDIS_CACHE_TTL);
          console.log("✅ YouTube ID를 Redis에 캐싱했습니다:", streaming_id);
        } else if (existingValue !== streaming_id) {
          await redis.set(redisKey, streaming_id, 'EX', REDIS_CACHE_TTL);
          console.log("🔄 Redis의 YouTube ID를 업데이트했습니다:", streaming_id);
        } else {
          console.log("ℹ️ 이미 Redis에 동일한 YouTube ID가 캐싱되어 있습니다.");
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


// GET /api/track?track_id=...
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
        console.log("✅ Redis 캐시에서 YouTube ID를 찾았습니다:", cachedVideoId);
        return res.json({ streaming_id: cachedVideoId });
      } else {
        console.log("ℹ️ Redis에 캐시된 YouTube ID가 없습니다. DB 확인 중...");
      }
    } catch (redisErr) {
      console.error("⚠️ Redis 접근 중 오류 발생:", redisErr);
    }
    
    // 2️⃣ MongoDB에서 검색
    const track = await Track.findOne({ track_id });
    if (track && track.streaming_id) {
      console.log("✅ DB에서 YouTube ID를 찾았습니다:", track.streaming_id);
      
      // DB에서 찾은 데이터를 Redis에 캐싱
      try {
        await redis.set(redisKey, track.streaming_id, 'EX', REDIS_CACHE_TTL);
        console.log("✅ DB의 YouTube ID를 Redis에 캐싱했습니다.");
      } catch (redisErr) {
        console.error("⚠️ Redis 캐싱 중 오류 발생:", redisErr);
      }
      
      return res.json({ streaming_id: track.streaming_id });
    } else {
      console.log("❌ YouTube ID를 찾을 수 없습니다. 클라이언트는 youtube.js API를 호출해야 합니다.");
      return res.status(404).json({ error: 'Track not found' });
    }
  } catch (error) {
    console.error('❌ Error fetching track:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;