// /routes/live.js
import express from 'express';
const router = express.Router();

// GET /api/live – Redis에 저장된 모든 liveSessions 정보를 반환 (변경된 부분)
router.get('/', async (req, res) => {
  try {
    const redis = req.app.locals.redis; // server.js에 설정된 Redis 인스턴스 사용
    const liveSessions = await redis.hGetAll('liveSessions');
    // Redis 해시의 값들을 JSON 파싱
    const sessions = Object.keys(liveSessions).map(key => JSON.parse(liveSessions[key]));
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching live sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
