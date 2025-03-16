<!-- /bravo-front/src/routes/podcast/+page.svelte -->
<script>
	// 기존 static import { io } from 'socket.io-client'; 는 제거되었습니다.
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	const backendUrl = import.meta.env.VITE_BACKEND_URL; // 기존 backendUrl 사용

	let liveStreams = [];
	let socket;

	// === 변경된 부분: 동적 임포트를 사용하여 socket.io-client 로드 ===
	onMount(async () => {
		// 동적 임포트를 통해 socket.io-client 모듈을 브라우저에서만 로드합니다.
		const { io } = await import('socket.io-client');
		socket = io(backendUrl, { transports: ['websocket'] });
		socket.on('liveStreams', (data) => {
			console.log('받은 라이브 스트림 데이터:', data);
			liveStreams = data;
		});
	});
	// === 변경된 부분 끝 ===

	onDestroy(() => {
		if (socket) socket.disconnect();
	});

	function goToLiveSong(liveUser) {
		// 라이브 카드 클릭 시 song 페이지로 이동, 쿼리 파라미터로 liveUser 정보 전달
		goto(`/song?liveUser=${liveUser.email}`);
	}
</script>

<div class="podcast-page">
	<h1>Live Podcasts</h1>
	{#if liveStreams.length > 0}
		<div class="live-cards">
			{#each liveStreams as stream (stream.user.email)}
				<div class="live-card" on:click={() => goToLiveSong(stream.user)}>
					<img src={stream.user.picture} alt="{stream.user.name}" class="live-profile" />
					<div class="live-info">
						<h3>{stream.user.name}</h3>
						<p>{stream.currentTrack.name} - {stream.currentTrack.artist}</p>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<p>현재 라이브 스트림이 없습니다.</p>
	{/if}
</div>

<style>
	.podcast-page {
		padding: 20px;
		background: #111;
		color: white;
		text-align: center;
	}
	.live-cards {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 20px;
		margin-top: 20px;
	}
	.live-card {
		background: #222;
		border-radius: 10px;
		padding: 10px;
		width: 200px;
		cursor: pointer;
		transition: transform 0.2s;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
	}
	.live-card:hover {
		transform: scale(1.05);
	}
	.live-profile {
		width: 100%;
		height: auto;
		border-radius: 50%;
	}
	.live-info {
		margin-top: 10px;
	}
	.live-info h3 {
		margin: 0;
		font-size: 18px;
	}
	.live-info p {
		margin: 5px 0 0;
		font-size: 14px;
		color: #aaa;
	}
</style>
