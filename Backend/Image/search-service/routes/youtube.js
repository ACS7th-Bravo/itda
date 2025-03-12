//Image/search-service/routes/youtube.js

import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const router = express.Router();
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

// ✅ YouTube API 키 읽기 (쉼표로 구분된 여러 개의 키)
const YOUTUBE_API_KEYS = readSecret('youtube_api_keys').split(",");
let currentApiKeyIndex = 0;
let currentApiKey = youtubeApiKeys[currentApiKeyIndex];

// API 키 로테이션 함수
function rotateApiKey() {
  currentApiKeyIndex = (currentApiKeyIndex + 1) % YOUTUBE_API_KEYS.length;
  currentApiKey = YOUTUBE_API_KEYS[currentApiKeyIndex];
  console.log(
    `[🔄 ${new Date().toLocaleString()}]  ${currentApiKeyIndex + 1}번째 YouTube API 키 변경됨: ${currentApiKey}`
  );
}


// GET /api/youtube/search?trackName=...&artistName=...
router.get("/search", async (req, res) => {
  // 요청 시마다 API 키를 라운드로빈 방식으로 변경
  rotateApiKey();

  const { trackName, artistName } = req.query;
  if (!trackName || !artistName) {
    return res
      .status(400)
      .json({ error: "trackName and artistName parameters are required" });
  }
  const searchQueryText = `${trackName} ${artistName} official audio`;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&regionCode=KR&safeSearch=none&q=${encodeURIComponent(
    searchQueryText
  )}&key=${currentApiKey}&maxResults=1`;
  
  console.log(`📡 YouTube API 요청: ${url}`);
  

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: "YouTube API error" });
    }
    const data = await response.json();
    const videoId = data.items?.length ? data.items[0].id.videoId : null;
    res.json({ videoId });
  } catch (error) {
    console.error("Error in /api/youtube/search:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;