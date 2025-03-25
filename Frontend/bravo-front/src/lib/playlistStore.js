// /bravo-front/src/lib/playlistStore.js

import { writable, get } from 'svelte/store';

// 플레이리스트에 담길 트랙 객체 배열을 관리하는 writable 스토어
export const playlist = writable([]);

/* 변경된 부분: 플레이리스트에 트랙을 추가하고, DB에 저장하는 함수 */
// userEmail: 현재 사용자의 이메일, playlistName은 기본 "My Playlist" (필요 시 변경)
export function addTrackToPlaylist(track, userEmail, playlistName = 'My Playlist') {
	playlist.update((tracks) => {
		const updatedTracks = [...tracks, track];
		// DB에 저장 (비동기로 저장)
		return updatedTracks;
	});
}

/*
  트랙 객체 예시:
  {
	name: "트랙 제목",
	artist: "아티스트 이름",
	albumImage: "앨범 이미지 URL",
	videoId: "유튜브 비디오 아이디" // 선택사항
  }
*/

/* 변경된 부분: DB에 플레이리스트를 저장하는 함수 */
export async function savePlaylistToDB(userEmail, playlistName, tracks) {
	try {
		const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/playlist`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'ngrok-skip-browser-warning': '69420'
			},
			// 변경: 백엔드 Playlist 스키마에서는 user의 이메일은 "email" 필드로 저장합니다.
			body: JSON.stringify({
				email: userEmail,
				name: playlistName,
				tracks: tracks.map((track) => ({
					// 변경: 검색 페이지에서 받은 track 객체의 id 또는 track_id를 사용 (데이터 구조에 맞게 조정)
					track_id: track.id || track.track_id,
					track_name: track.name,
					artist_id: track.artist_id || 'unknown',
					artist_name: track.artist || '알 수 없음',
					album_id: track.album_id || (track.album ? track.album.id : 'unknown'),
					// 변경: album 이미지는 track.album.images[0].url 또는 track.imageUrl 사용
					album_image: track.album?.images
						? track.album.images[0].url
						: track.imageUrl || '/default-album.png'
				}))
			})
		});
		if (!response.ok) {
			throw new Error('플레이리스트 저장에 실패하였습니다.');
		}
		const data = await response.json();
		// console.log('플레이리스트 저장 성공:', data);
	} catch (error) {
		console.error('플레이리스트 저장 중 에러 발생:', error);
	}
}