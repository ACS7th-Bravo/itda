// /bravo-front/src/lib/trackPlayer.js
import { get } from 'svelte/store';

// .env 파일에 설정된 백엔드 URL을 사용합니다.
// 만약 환경변수가 없다면 기본값 http://localhost:3001 을 사용합니다.
const backendUrl = import.meta.env.VITE_BACKEND_URL;

// [추가된 부분] : DB에서 streaming_id를 가져오는 함수
// 이 함수는 DB(백엔드 API)를 통해서 해당 track_id를 가진 트랙의 streaming_id를 가져옵니다.
// streaming_id가 있다면 DB에서 가져온 것으로 간주하고 반환합니다.
async function getStreamingIdFromDB(trackId) {
	try {
		const response = await fetch(`${backendUrl}/api/track?track_id=${trackId}`, {
			headers: {
				'Content-Type': 'application/json',
				'ngrok-skip-browser-warning': '69420' // ✅ ngrok 보안 경고 우회
			}
		});
		if (response.ok) {
			const data = await response.json();
			// data.streaming_id가 존재하면 DB에서 가져온 streaming_id임
			if (data && data.streaming_id) {
				console.log('🔍 DB에서 가져온 streaming_id:', data.streaming_id);
				return data.streaming_id; // DB에서 가져온 streaming_id
			}
		}
	} catch (error) {
		console.error('DB에서 streaming_id 가져오기 실패:', error);
	}
	return null;
}
// ======================

// ✅ YouTube에서 videoId 가져오기 (백엔드 호출)
export async function getYouTubeVideo(trackName, artistName) {
	const url = `${backendUrl}/api/youtube/search?trackName=${encodeURIComponent(trackName)}&artistName=${encodeURIComponent(artistName)}`;
	console.log('검색한 키워드: ', `${trackName} ${artistName} official audio`);
	console.log('백엔드 유튜브 검색 url은: ', url);

	try {
		const response = await fetch(url, {
			headers: {
				'Content-Type': 'application/json', // ✅ JSON 요청
				'ngrok-skip-browser-warning': '69420' // ✅ ngrok 보안 경고 우회
			}
		});
		if (!response.ok) {
			throw new Error(`HTTP 오류! 상태 코드: ${response.status}`);
		}
		const data = await response.json();
		return data.videoId || null;
	} catch (error) {
		console.error('❌ YouTube 검색 요청 실패:', error);
		return null;
	}
}

// 준현 수정 - playTrack 영문 이름으로 조회
// ✅ 트랙 재생 함수
export async function playTrack(track, index) {
	if (!localStorage.getItem('jwt_token')) {
		alert('로그인 후 음악을 재생할 수 있습니다.');
		return;
	}

	if (!track) {
		console.error('❌ 재생할 트랙 정보가 없습니다.', track);
		alert('❌ 재생할 수 없는 트랙입니다.');
		return;
	}

	console.log('▶️ track 정보: ', track);

	// ✅ 영어 제목 & 영어 아티스트명을 우선적으로 사용
	const trackName = track.englishTrackName || track.name || 'Unknown Track';
	const artistName = track.englishArtistName
		? track.englishArtistName
		: track.artists
			? track.artists.map((a) => a.name).join(', ')
			: track.artist || 'Unknown Artist';

	console.log('🎵 English Name: ', trackName);
	console.log('🎵 English Artist: ', artistName);

	let videoId = await getStreamingIdFromDB(track.id);
	if (videoId) {
		console.log('✅ DB에서 가져온 streaming_id 사용:', videoId);
		console.log('※ 이 streaming_id는 DB에서 가져온 것입니다.');
	} else {
		// DB에 해당 트랙의 streaming_id가 없으면 기존대로 YouTube API를 호출합니다.
		videoId = await getYouTubeVideo(trackName, artistName);
		console.log('✅ YouTube API를 통해 가져온 streaming_id:', videoId);
		console.log('※ 이 streaming_id는 YouTube API에서 가져온 것입니다.');
	}
	// ============================================================

	if (videoId) {
		window.dispatchEvent(new CustomEvent('playTrack', { detail: { videoId, track, index } }));
	} else {
		alert('❌ YouTube에서 영상을 찾을 수 없습니다.');
	}
}