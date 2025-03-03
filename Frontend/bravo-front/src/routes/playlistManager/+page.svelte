<script>
	import { onMount, getContext } from 'svelte';
	import { playlistManager } from '$lib/playlistManagerStore.js';
	// 전역 재생 큐는 이제 사용하지 않습니다.
	// import { playTrack } from '$lib/trackPlayer.js';

	// 새로 추가: 페이지 이동을 위한 goto 함수
	import { goto } from '$app/navigation';

	const currentUser = getContext('currentUser');
	$: userEmail = $currentUser ? $currentUser.email : '';

	let userName = '';
	if (currentUser && currentUser.name) {
		userName = currentUser.name;
	}
	let userEmail = '';
	if (currentUser && currentUser.email) {
		userEmail = currentUser.email;
	}
	const backendUrl = import.meta.env.VITE_BACKEND_URL;

	// 플레이리스트 데이터를 불러오는 onMount 함수 (기존 코드 재사용)
	onMount(async () => {
		if (userEmail) {
			try {
				const res = await fetch(`${backendUrl}/api/playlist?user_id=${userEmail}`, {
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						'ngrok-skip-browser-warning': '69420'
					}
				});
				if (!res.ok) {
					throw new Error('플레이리스트 조회 실패');
				}
				const text = await res.text();
				console.log('플레이리스트 로드 응답 텍스트:', text);
				const data = JSON.parse(text);
				playlistManager.set(data);
			} catch (error) {
				console.error(error);
			}
		}
	});

	// 플레이리스트 썸네일 클릭 시 재생 대신 상세 페이지로 이동하도록 수정 (동적 경로 대신 쿼리 파라미터 사용)
	function goToPlaylistDetail(playlist) {
		console.log('플레이리스트 객체:', playlist);

		// 예: /playlistDetail?playlistId={playlist._id} 로 이동
		goto(`/playlistDetail?playlistId=${playlist._id}`);

	}
</script>

{#if !userEmail}
	<div class="login-prompt">
		플레이리스트를 확인하려면 로그인이 필요합니다. 로그인 페이지로 이동해주세요.
	</div>
{:else}
	<div class="playlist-manager-container">
		<h2>{userName}님의 플레이리스트</h2>
		{#if $playlistManager.length > 0}
			<div class="playlist-grid">
				{#each $playlistManager as playlist (playlist._id)}
					<!-- 클릭 시 재생 대신 상세 페이지로 이동 -->
					<div
						class="playlist-item"
						role="button"
						tabindex="0"
						on:click={() => goToPlaylistDetail(playlist)}
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								goToPlaylistDetail(playlist);
							}
						}}
					>
						<div class="playlist-thumbnail fade-in" >
							{#each [0, 1, 2, 3] as idx}
								<div class="thumbnail-cell">
									{#if playlist.tracks && playlist.tracks[idx]}
										<img src={playlist.tracks[idx].album_image} alt="Album" />
									{:else}
										<img src="/default-album.png" alt="Default Album" />
									{/if}
								</div>
							{/each}
						</div>
						<div class="playlist-name fade-in">{playlist.name}</div>
					</div>
				{/each}
			</div>
		{:else}
			<p>등록된 플레이리스트가 없습니다.</p>
		{/if}
	</div>
{/if}

<style>
	.playlist-manager-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
	}
	h2 {
		text-align: left;
		margin-bottom: 20px;
		color: white;
	}
	/* 5열 그리드 */
	.playlist-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 30px;
		justify-items: center;
	}
	.playlist-item {
		padding: 10px;
		cursor: pointer;
		transition: transform 0.2s;
		outline: none;
	}
	.playlist-item:hover {
		transform: scale(1.05);
	}
	.playlist-thumbnail {
		position: relative;
		width: 200px;
		padding-bottom: 200px;
		display: grid;
		grid-template-columns: 50% 50%;
		grid-template-rows: 50% 50%;
		gap: 1px;
		background: none;
		/* 초기에는 opacity 0 상태로 둡니다. */
		opacity: 0;
	}
	.thumbnail-cell {
		position: absolute;
		overflow: hidden;
	}
	.thumbnail-cell:nth-child(1) {
		top: 0;
		left: 0;
		width: 50%;
		height: 50%;
	}
	.thumbnail-cell:nth-child(2) {
		top: 0;
		left: 50%;
		width: 50%;
		height: 50%;
	}
	.thumbnail-cell:nth-child(3) {
		top: 50%;
		left: 0;
		width: 50%;
		height: 50%;
	}
	.thumbnail-cell:nth-child(4) {
		top: 50%;
		left: 50%;
		width: 50%;
		height: 50%;
	}
	.thumbnail-cell img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.playlist-name {
		margin-top: 8px;
		text-align: center;
		color: white;
		font-weight: bold;
	}
	.login-prompt {
		text-align: center;
		margin-top: 50px;
		font-size: 1.5rem;
		color: white;
	}

	/* fade-in 애니메이션 */
	.fade-in {
		animation: fadeInAnimation 0.5s ease-in-out forwards;
	}
	@keyframes fadeInAnimation {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
