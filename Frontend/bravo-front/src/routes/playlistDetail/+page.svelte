<!-- /bravo-front/src/routes/playlistDetail/+page.svelte -->
<script>
	import { onMount } from 'svelte';
	import { writable, get } from 'svelte/store'; // get() 추가
	import { page } from '$app/stores'; // URL 접근을 위해 추가
	import { playTrack } from '$lib/trackPlayer.js';
	// 추가: 전역 재생 큐 컨텍스트 가져오기
	import { getContext } from 'svelte'; /* 수정: 전역 재생 큐 업데이트를 위해 추가 */
	const currentQueue = getContext('currentQueue'); /* 수정: 전역 재생 큐 컨텍스트 가져옴 */

	const backendUrl = import.meta.env.VITE_BACKEND_URL;

	// 플레이리스트 상세 정보를 저장할 스토어와 에러 메시지 스토어 생성
	let playlistDetail = writable(null);
	let errorMessage = writable('');

	// 페이지 로드시 쿼리 파라미터에서 playlistId를 추출 후 해당 플레이리스트 상세 정보를 불러옴
	onMount(async () => {
		// 변경된 부분: get(page)를 사용해 URL의 쿼리 파라미터에서 playlistId 추출
		const $page = get(page);
		const playlistId = $page.url.searchParams.get('playlistId'); // <-- playlistId 추출
		if (!playlistId) {
			errorMessage.set('플레이리스트 ID가 전달되지 않았습니다.');
			return;
		}
		try {
			const res = await fetch(`${backendUrl}/api/playlist/${playlistId}`, {
				headers: {
					'Content-Type': 'application/json',
					'ngrok-skip-browser-warning': '69420' // 이 헤더 추가!
				}
			});
			if (!res.ok) {
				throw new Error('플레이리스트 상세 정보를 불러오는데 실패했습니다.');
			}
			const data = await res.json();
			playlistDetail.set(data);
			/* 추가: 플레이리스트 상세 정보를 받으면 전역 재생 큐도 업데이트 (글로벌 플레이어에서 다음곡 버튼이 작동하도록) */
			if (data && data.tracks) {
				currentQueue.set(
					data.tracks.map((t) => ({
						id: t.track_id,
						name: t.track_name,
						artist: t.artist_name,
						artist_id: t.artist_id,
						album_id: t.album_id,
						imageUrl: t.album_image,
						englishTrackName: t.track_name,
						englishArtistName: t.artist_name,
						source: 'playlistDetail'
					}))
				);
			}
		} catch (error) {
			console.error(error);
			errorMessage.set(error.message);
		}
	});

	// 재생 버튼 클릭 시, 해당 트랙을 재생 큐에 넣고 재생 시작
	function playTrackFromDetail(track, index) {
		const formattedTrack = {
			id: track.track_id,
			name: track.track_name,
			artist: track.artist_name,
			artist_id: track.artist_id,
			album_id: track.album_id,
			imageUrl: track.album_image,
			englishTrackName: track.track_name,
			englishArtistName: track.artist_name,
			source: 'playlistDetail'
		};
		// (전역 재생 큐는 이미 onMount에서 업데이트됨)
		playTrack(formattedTrack, index);
	}
</script>

{#if $errorMessage}
	<div class="error">{$errorMessage}</div>
{:else if $playlistDetail}
	<div class="playlist-detail-container">
		<h1>{$playlistDetail.name}</h1>
		<ul class="track-list">
			{#each $playlistDetail.tracks as track, index}
				<li class="track-item">
					<img src={track.album_image} alt={track.track_name} class="track-thumbnail" />
					<div class="track-info">
						<strong>{track.track_name}</strong>
						<p>{track.artist_name}</p>
					</div>
					<button on:click={() => playTrackFromDetail(track, index)}>▶️ 재생</button>
				</li>
			{/each}
		</ul>
	</div>
{:else}
	<div class="loading">플레이리스트 정보를 불러오는 중...</div>
{/if}

<style>
	.playlist-detail-container {
		max-width: 800px;
		margin: 0 auto;
		padding: 20px;
		color: white;
	}
	h1 {
		text-align: center;
		margin-bottom: 20px;
	}
	.track-list {
		list-style: none;
		padding: 0;
	}
	.track-item {
		display: flex;
		align-items: center;
		padding: 10px;
		border-bottom: 1px solid #444;
	}
	.track-thumbnail {
		width: 60px;
		height: 60px;
		object-fit: cover;
		margin-right: 15px;
		border-radius: 4px;
	}
	.track-info {
		flex-grow: 1;
	}
	.track-info strong {
		font-size: 16px;
	}
	.track-info p {
		margin: 0;
		font-size: 14px;
		color: #ccc;
	}
	button {
		background-color: #1db954;
		border: none;
		color: white;
		padding: 8px 12px;
		border-radius: 4px;
		cursor: pointer;
	}
	button:hover {
		background-color: #17a44d;
	}
	.error {
		color: red;
		text-align: center;
		margin: 20px;
	}
	.loading {
		text-align: center;
		margin: 20px;
		color: white;
	}
</style>
