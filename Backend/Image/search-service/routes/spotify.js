//Image/search-service/routes/spotify.js

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

const clientId = readSecret('spotify_client_id');
const clientSecret = readSecret('spotify_client_secret');
const TOKEN_LIFETIME = 3600; // 1시간 (초 단위)

let accessToken = null;
let tokenExpiresAt = 0;

async function fetchAccessToken() {
  const url = "https://accounts.spotify.com/api/token";
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await response.json();
  if (data.access_token) {
    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + TOKEN_LIFETIME * 1000;
    console.log("✅ Spotify access token fetched.");
    return accessToken;
  } else {
    throw new Error("❌ Failed to fetch Spotify access token");
  }
}

async function getAccessToken() {
  if (!accessToken || Date.now() >= tokenExpiresAt) {
    await fetchAccessToken();
  }
  return accessToken;
}


// ✅ Spotify API에서 한글 & 영어 데이터 가져오는 함수
async function fetchSpotifyData(query, locale = null) {
  const token = await getAccessToken();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=50${locale ? `&locale=${locale}` : ""}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    console.error(`❌ Spotify API error: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data.tracks.items || [];
}

// 🎯 Spotify 검색 API (한글 & 영어 데이터를 따로 가져옴)
router.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: "❌ Query parameter q is required" });
  }

  try {
    const koreanTracks = await fetchSpotifyData(query, "ko,en-US");
    const englishTracks = await fetchSpotifyData(query);

    // Combine Korean and English data
    const results = koreanTracks.map((track, index) => {
      const englishTrack = englishTracks[index] || track; // Fallback to Korean data if English is missing
      return {
        id: track.id,
        name: track.name,
        artist: track.artists.map(artist => artist.name).join(", "),
        imageUrl: track.album.images.length > 0 ? track.album.images[0].url : null,
        album_id: track.album && track.album.id ? track.album.id : null,
        artist_id: track.artists && track.artists[0] && track.artists[0].id ? track.artists[0].id : null,
        originalTrackName: track.name,
        originalArtistName: track.artists.map(artist => artist.name).join(", "),
        englishTrackName: englishTrack.name,
        englishArtistName: englishTrack.artists.map(artist => artist.name).join(", ")
      };
    });

    //console.log("🔍 Spotify API 응답 결과:", JSON.stringify(results, null, 2));
    res.json(results);
  } catch (error) {
    console.error("❌ Error in /api/spotify/search:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;