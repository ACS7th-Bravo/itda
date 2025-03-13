//Image/lyrics-service/routes/lyrics.js

import express from 'express';
import fetch from 'node-fetch';
import { Track } from '../models/Track.js';
import { createClient } from 'redis';
import fs from 'fs';
import path from 'path';



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


const router = express.Router();

const LRCLIB_API_BASE = readSecret('lrclib_api_base');
const MUSIXMATCH_API_KEY = readSecret('musixmatch_api_key');
const MUSIXMATCH_API_HOST = readSecret('musixmatch_api_host');
const REDIS_URL = readSecret('mongo_uri');

// Redis 클라이언트 설정
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', err => console.error('Redis Client Error', err));
await redisClient.connect();

/**
 * 문자열 정리 함수 (필요시 확장 가능)
 */
function cleanQueryString(str) {
  return str
    .replace(/’/g, "'")          // 오른쪽 작은 따옴표를 일반 따옴표로 변환
    .replace(/\s*\(.*$/, "")      // 공백과 '(' 이후의 모든 문자 제거
    .trim();                     // 앞뒤 공백 제거
}


/**
 * LRCLIB의 /api/get 엔드포인트를 단일 시도로 호출합니다.
 * 404나 '찾을 수 없음' 응답이면 바로 null 반환합니다.
 */
async function fetchLyricsLrcLib(song, artist, album = null, duration = null, retries = 1) {
  const cleanSong = cleanQueryString(song);
  const cleanArtist = cleanQueryString(artist);

  const queryParams = new URLSearchParams({
    track_name: cleanSong,
    artist_name: cleanArtist
  });
  if (album) queryParams.append("album_name", cleanQueryString(album));
  if (duration) queryParams.append("duration", duration.toString());

  const url = `${LRCLIB_API_BASE}/api/get`;
  try {
    console.log(`📡 [백엔드] LRCLIB API 요청: ${url}?${queryParams}`);
    const response = await fetch(`${url}?${queryParams}`);

    if (response.status === 404) {
      console.warn("⚠️ [백엔드] LRCLIB API 404 응답: 트랙을 찾지 못했습니다.");
      return null;
    }

    if (!response.ok) {
      console.error(`❌ [백엔드] LRCLIB API 오류 (HTTP ${response.status})`);
      return null;
    }

    const data = await response.json();
    if (data.code === 404) {
      console.warn("⚠️ [백엔드] LRCLIB: 트랙을 찾지 못했습니다. (data.code === 404)");
      return null;
    }

    if (data.syncedLyrics) {
      return data.syncedLyrics;
    } else if (data.plainLyrics) {
      return data.plainLyrics;
    }
  } catch (error) {
    console.error(`❌ [백엔드] LRCLIB API 호출 중 오류 발생:`, error);
  }
  return null;
}

/**
 * Musixmatch API를 단일 시도로 호출합니다.
 * (우리는 별도의 subtitles 엔드포인트를 사용하지 않습니다.)
 * 만약 API 응답이 리스트 형태(각 항목에 time 정보가 있는 경우)라면,
 * 각 항목을 "[mm:ss.xx] text" 형식의 문자열로 변환하여 반환합니다.
 */
async function fetchLyricsMusixmatch(song, artist, retries = 1) {
  const cleanSong = cleanQueryString(song);
  const cleanArtist = cleanQueryString(artist);
  const url = "https://musixmatch-lyrics-songs.p.rapidapi.com/songs/lyrics";
  const querystring = new URLSearchParams({
    t: cleanSong,
    a: cleanArtist,
    type: "json"
  });
  const headers = {
    "x-rapidapi-key": MUSIXMATCH_API_KEY,
    "x-rapidapi-host": MUSIXMATCH_API_HOST
  };

  try {
    console.log(`📡 [백엔드] Musixmatch API 요청: ${url}?${querystring}`);
    const response = await fetch(`${url}?${querystring}`, { headers });

    if (response.status === 404) {
      console.warn("⚠️ [백엔드] Musixmatch API 404 응답: 가사를 찾지 못했습니다.");
      return null;
    }

    if (!response.ok) {
      console.error(`❌ [백엔드] Musixmatch API 오류 (HTTP ${response.status})`);
      return null;
    }

    const data = await response.json();
    // 만약 API 응답이 리스트 형태라면 타임스탬프와 텍스트를 포맷합니다.
    if (Array.isArray(data) && data.length > 0) {
      const formatted = data.map(item => {
        const t = item.time || {};
        const minutes = t.minutes || 0;
        const seconds = t.seconds || 0;
        const hundredths = t.hundredths || 0;
        // "mm:ss.xx" 형식으로 생성
        const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
        return `[${formattedTime}] ${item.text || ""}`;
      }).join('\n');
      return formatted;
    }

    // 리스트 형태가 아니라면 기존 방식으로 처리
    const lyrics = data.message?.body?.lyrics?.lyrics_body;
    if (lyrics) {
      return lyrics;
    }
  } catch (error) {
    console.error(`❌ [백엔드] Musixmatch API 호출 중 오류 발생:`, error);
  }
  return null;
}

router.get('/', async (req, res) => {
  console.log("📢 [백엔드] /api/lyrics 요청 받음");
  console.log("👉 받은 쿼리 파라미터:", req.query);

  const { track_id, song, artist, album, duration, englishTrackName, englishArtistName } = req.query;
  const trackNameToSearch = englishTrackName || song;
  const artistNameToSearch = englishArtistName || artist;

  // 캐시 키 생성: track_id가 있으면 이를 사용, 없으면 song과 artist로 생성
  const cacheKey = track_id
    ? `lyrics:${track_id}`
    : `lyrics:${cleanQueryString(song)}:${cleanQueryString(artist)}`;

  // 1. Redis 캐시 조회
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log("✅ [Redis] 캐시 히트 - Redis에서 가사를 가져왔습니다.");
      return res.json(JSON.parse(cachedData));
    }
  } catch (err) {
    console.error("❌ [Redis] 캐시 조회 중 오류:", err);
  }

  if (track_id) {
    try {
      const trackDoc = await Track.findOne({ track_id });
      if (trackDoc && trackDoc.plain_lyrics && trackDoc.parsed_lyrics) {
        console.log("✅ [DB] MongoDB에서 가사를 불러왔습니다.");
        const responseData = {
          song,
          artist,
          album,
          duration,
          lyrics: trackDoc.parsed_lyrics,
          parsedLyrics: trackDoc.parsed_lyrics
        };
        // Redis에 저장 (TTL: 24시간)
        await redisClient.setEx(cacheKey, 86400, JSON.stringify(responseData));
        return res.json(responseData);
      }
    } catch (err) {
      console.error("❌ [DB] MongoDB 조회 오류:", err);
    }
    console.log("DB에 저장된 가사가 없습니다. 외부 API로 가사를 불러옵니다.");
  }


  let lyrics = null;

  // LRCLIB API 2회 시도
  for (let i = 0; i < 2; i++) {
    console.log(`📡 [백엔드] LRCLIB API 시도 ${i + 1}번째`);
    lyrics = await fetchLyricsLrcLib(trackNameToSearch, artistNameToSearch, album, duration, 1);
    if (lyrics) break;
    // 시도 간 1초 대기
    await new Promise(res => setTimeout(res, 1000));
  }


  // LRCLIB에서 찾지 못하면 Musixmatch API 2회 시도
  if (!lyrics) {
    console.warn("⚠️ [백엔드] LRCLIB에서 가사를 찾지 못했습니다. Musixmatch API를 호출합니다.");
    for (let i = 0; i < 2; i++) {
      console.log(`📡 [백엔드] Musixmatch API 시도 ${i + 1}번째`);
      lyrics = await fetchLyricsMusixmatch(trackNameToSearch, artistNameToSearch, 1);
      if (lyrics) break;
      await new Promise(res => setTimeout(res, 1000));
    }
  }

  if (!lyrics) {
    return res.status(404).json({
      error: "LRCLIB과 Musixmatch API 모두에서 가사를 찾을 수 없습니다."
    });
  }

  // ─────────────────────────────────────────────
  // [추가] 타임스탬프가 포함된 가사 문자열을 파싱하여,
  // 백엔드 로그에는 타임스탬프와 텍스트 분리 결과를 남기고,
  // 프론트엔드에는 타임스탬프를 제거한 순수 가사와 파싱 결과(parsedLyrics)를 함께 전달합니다.
  if (typeof lyrics !== 'string') {
    console.error("❌ [백엔드] 가사 데이터 형식이 올바르지 않습니다:", lyrics);
    return res.status(500).json({
      error: "가사 데이터 처리 중 오류가 발생했습니다."
    });
  }
  const pattern = /\[(\d{2}:\d{2}\.\d{2})\]\s*(.*)/;
  const lines = lyrics.split("\n");
  const result = [];
  for (let line of lines) {
    const match = line.match(pattern);
    if (match) {
      result.push({ time: match[1], text: match[2] });
    }
  }
  let plainLyrics;
  if (result.length > 0) {
    console.log("📝 [백엔드] 파싱된 가사:", result);
    // 프론트엔드에는 타임스탬프 없이 텍스트만 전달
    plainLyrics = result.map(item => item.text).join("\n");
  } else {
    plainLyrics = lyrics;
  }
  // ─────────────────────────────────────────────

  // MongoDB에 저장/업데이트
  if (track_id) {
    try {
      await Track.findOneAndUpdate(
        { track_id },
        { plain_lyrics: plainLyrics, parsed_lyrics: result.length > 0 ? result : null },
        { upsert: true }
      );
      console.log("✅ [DB] DB에 가사 저장/업데이트 완료.");
    } catch (err) {
      console.error("❌ [DB] MongoDB 업데이트 오류:", err);
    }
  }

  const responseData = {
    song,
    artist,
    album,
    duration,
    lyrics: result.length > 0 ? plainLyrics : lyrics,
    parsedLyrics: result.length > 0 ? result : null
  };

  // Redis에 저장 (TTL 24시간)
  try {
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(responseData));
    console.log("✅ [Redis] Redis에 가사 저장 완료.");
  } catch (err) {
    console.error("❌ [Redis] Redis 저장 오류:", err);
  }

  console.log("📝 [백엔드] 외부에서 불러온 원본 가사:", lyrics);
  return res.json(responseData);
});

export default router;