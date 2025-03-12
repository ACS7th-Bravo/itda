// backend/routes/track.js
import express from 'express';
import { Track } from '../models/Track.js';
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

// MongoDB URI 불러오기
const MONGO_URI = readSecret('mongo_uri');

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
    const track = await Track.findOne({ track_id });
    if (track) {
      res.json({ streaming_id: track.streaming_id });
    } else {
      res.status(404).json({ error: 'Track not found' });
    }
  } catch (error) {
    console.error('Error fetching track:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;