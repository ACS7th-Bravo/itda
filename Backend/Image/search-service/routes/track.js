import express from 'express';
import { Track } from '../models/Track.js';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Redis 클라이언트 설정
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://redis-service.itda-redis-ns.svc.cluster.local:6379'
});
redis.on('error', err => console.error('Redis Client Error', err));
await redis.connect();

// Redis 키 TTL 설정 (초 단위, 24시간)
const REDIS_CACHE_TTL = 60 * 60 * 24;

// Redis 키 prefix 설정
const REDIS_KEY_PREFIX = 'track:youtube:';

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

    // streaming_id가 제공되었다면 Redis에도 저장
    if (streaming_id && track_id) {
      try {
        // Redis에 이미 있는지 확인 후 없을 때만 저장
        const redisKey = REDIS_KEY_PREFIX + track_id;
        const existingValue = await redis.get(redisKey);
        
        if (!existingValue) {
          await redis.set(redisKey, streaming_id, 'EX', REDIS_CACHE_TTL);
          console.log("✅ YouTube ID를 Redis에 캐싱했습니다:", streaming_id);
        } else if (existingValue !== streaming_id) {
          // 기존 값과 다를 경우에만 업데이트
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
    console.error('Error saving track:', error);
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
    
    // 1. Redis에서 먼저 확인
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
      // Redis 오류는 무시하고 계속 진행
    }
    
    // 2. MongoDB에서 검색
    const track = await Track.findOne({ track_id });
    if (track && track.streaming_id) {
      console.log("✅ DB에서 YouTube ID를 찾았습니다:", track.streaming_id);
      
      // DB에서 찾은 데이터를 Redis에 캐싱 (이미 캐싱된 경우 제외)
      try {
        // 위에서 이미 Redis에 없다고 확인했으므로 바로 저장
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
    console.error('Error fetching track:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;