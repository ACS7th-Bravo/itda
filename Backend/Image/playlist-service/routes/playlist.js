//Image/playlist-service/routes/playlist.js

import express from 'express';
import { Playlist } from '../models/Playlist.js';
import { User } from '../models/User.js';
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

const MONGO_URI = readSecret('mongo_uri'); // MongoDB 연결 URI
const router = express.Router();

// POST 요청을 통한 플레이리스트 그룹 생성
router.post('/', async (req, res) => {
  try {
    const { email, name, tracks } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: 'email과 name은 필수입니다.' });
    }

    // 동일한 이름의 플레이리스트가 이미 존재하는지 확인
    const existingPlaylist = await Playlist.findOne({ email, name });
    if (existingPlaylist) {
      return res.status(400).json({ error: '이미 해당 이름의 플레이 리스트가 존재합니다.' });
    }
    // 새로운 플레이리스트 그룹 생성 (visible은 명시하지 않아도 기본값 true가 적용됨)
    const newPlaylist = new Playlist({
      email,
      name,
      tracks
      // 여기서 visible을 따로 지정하지 않으면 모델에 설정한 기본값(true)이 적용됩니다.
    });
    await newPlaylist.save();
    res.status(201).json(newPlaylist);
  } catch (error) {
    console.error('플레이리스트 그룹 생성 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// 기존 GET 핸들러
router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
     // visible이 false인 항목은 조회하지 않고, visible 필드가 없거나 true인 경우만 반환
     const playlists = await Playlist.find({
      email: user_id,
      $or: [
        { visible: { $exists: false } },
        { visible: true }
      ]
    });
    res.status(200).json(playlists);
  } catch (error) {
    console.error('Fetching playlists failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// <<추가>> 단일 플레이리스트 상세 정보를 ID로 조회하는 라우트 추가
router.get('/:playlistId', async (req, res) => {  // 추가된 부분
  try {
    const { playlistId } = req.params;        // 추가된 부분: URL 파라미터로부터 playlistId 추출
    const playlist = await Playlist.findById(playlistId);  // 추가된 부분: ID로 조회
    if (!playlist) {                          // 추가된 부분
      return res.status(404).json({ error: '플레이리스트를 찾을 수 없습니다.' });  // 추가된 부분
    }
    res.status(200).json(playlist);            // 추가된 부분
  } catch (error) {                            // 추가된 부분
    console.error('플레이리스트 상세 정보 조회 실패:', error);  // 추가된 부분
    res.status(500).json({ error: error.message });  // 추가된 부분
  }
});
// <<끝>> 단일 플레이리스트 상세 정보를 ID로 조회하는 라우트 추가

router.patch('/:playlistId', async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { tracksToAdd } = req.body;
    if (!tracksToAdd || !Array.isArray(tracksToAdd)) {
      return res.status(400).json({ error: 'tracksToAdd 배열이 필요합니다.' });
    }
    // 기존 플레이리스트에 새 트랙들을 맨 앞에 추가 (새로운 트랙들이 앞쪽에 오도록)
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      { $push: { tracks: { $each: tracksToAdd, $position: 0 } } },
      { new: true }
    );
    if (!updatedPlaylist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(updatedPlaylist);
  } catch (error) {
    console.error('기존 플레이리스트 업데이트 실패:', error);
    res.status(500).json({ error: error.message });
  }
});


// === NEW ADDITIONS START: 플레이리스트 제목 변경 엔드포인트 ===
router.patch('/:playlistId/title', async (req, res) => {
  try {
    const { newTitle } = req.body;
    if (!newTitle) {
      return res.status(400).json({ error: 'newTitle 필드가 필요합니다.' });
    }
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      req.params.playlistId,
      { name: newTitle },
      { new: true }
    );
    if (!updatedPlaylist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(updatedPlaylist);
  } catch (error) {
    console.error('플레이리스트 제목 변경 실패:', error);
    res.status(500).json({ error: error.message });
  }
});
// === NEW ADDITIONS END ===

// === NEW ADDITIONS START: 플레이리스트 삭제 엔드포인트 ===
router.delete('/:playlistId', async (req, res) => {
  try {
    const deletedPlaylist = await Playlist.findByIdAndDelete(req.params.playlistId);
    if (!deletedPlaylist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('플레이리스트 삭제 실패:', error);
    res.status(500).json({ error: error.message });
  }
});
// === NEW ADDITIONS END ===

// === NEW ADDITIONS START: 플레이리스트 내 특정 트랙 삭제 엔드포인트 ===
router.patch('/:playlistId/remove-track', async (req, res) => {
  try {
    const { trackId } = req.body;
    if (!trackId) {
      return res.status(400).json({ error: 'trackId is required' });
    }
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      req.params.playlistId,
      { $pull: { tracks: { track_id: trackId } } },
      { new: true }
    );
    if (!updatedPlaylist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(updatedPlaylist);
  } catch (error) {
    console.error('트랙 삭제 실패:', error);
    res.status(500).json({ error: error.message });
  }
});
// === NEW ADDITIONS END ===


// === NEW ADDITIONS START: 공유 API 엔드포인트 수정 (디버깅 로그 추가) ===
router.post('/share', async (req, res) => {
  try {
    let { originalPlaylistId, recipientEmail } = req.body;
    if (!originalPlaylistId || !recipientEmail) {
      return res.status(400).json({ error: 'originalPlaylistId와 recipientEmail은 필수입니다.' });
    }
    
    // 입력받은 recipientEmail을 정규화 (공백 제거, 소문자 변환)
    recipientEmail = recipientEmail.trim().toLowerCase();
    console.log("[공유 API] 정규화된 recipientEmail:", recipientEmail); // 추가 로그

    // 수신자 이메일에 해당하는 유저 검사 (User 모델의 이메일 필드 기준)
    const recipientUser = await User.findOne({ email: recipientEmail });
    console.log("[공유 API] 조회된 recipientUser:", recipientUser); // 추가 로그
    if (!recipientUser) {
      return res.status(400).json({ error: '존재하지 않는 유저입니다.' });
    }
    
    const originalPlaylist = await Playlist.findById(originalPlaylistId);
    if (!originalPlaylist) {
      return res.status(404).json({ error: '원본 플레이리스트를 찾을 수 없습니다.' });
    }
    
    // 송신자(원본 플레이리스트 소유자) 정보를 가져오되, 검사하지 않고 이름만 사용
    const senderUser = await User.findOne({ email: originalPlaylist.email });
    // senderUser가 없으면 원본 플레이리스트의 email을 대신 사용
    const senderName = senderUser ? senderUser.name : originalPlaylist.email;
    
    const now = new Date();
    const formattedTime = now.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    const sharedPlaylistName = `${originalPlaylist.name} (${senderName} ${formattedTime}에 공유됨)`;

    const sharedPlaylist = new Playlist({
      email: recipientEmail,
      name: sharedPlaylistName,
      tracks: originalPlaylist.tracks,
      visible: true
    });
    await sharedPlaylist.save();
    res.status(201).json(sharedPlaylist);
  } catch (error) {
    console.error('플레이리스트 공유 실패:', error);
    res.status(500).json({ error: error.message });
  }
});
// === NEW ADDITIONS END ===



export default router;