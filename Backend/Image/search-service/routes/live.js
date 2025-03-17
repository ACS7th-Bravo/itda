// /routes/live.js
import express from 'express';
const router = express.Router();

// search-service/routes/live.js - GET /api/live 핸들러 수정
router.get('/', async (req, res) => {
    try {
        const redis = req.app.locals.redis;
        const liveSessions = await redis.hGetAll('liveSessions');
        console.log(`Redis에서 가져온 liveSessions: ${JSON.stringify(liveSessions)}`);
        
        // Redis 해시의 값들을 JSON 파싱하고 필요한 정보만 클라이언트에 전달
        const sessions = Object.entries(liveSessions).map(([key, value]) => {
            const parsedSession = JSON.parse(value);
            // 중요: track 객체가 없는 경우 처리
            if (!parsedSession.track) {
                console.warn(`⚠️ 세션 ${key}에 트랙 정보 없음:`, parsedSession);
                return null;
            }
            return {
                user: parsedSession.user,
                track: {
                    name: parsedSession.track.name,
                    artist: parsedSession.track.artist,
                    albumImage: parsedSession.track.albumImage
                }
            };
        }).filter(session => session !== null); // 유효하지 않은 세션 필터링
        
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching live sessions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;