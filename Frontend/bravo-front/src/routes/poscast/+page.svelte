<!-- /bravo-front/src/routes/podcast/+page.svelte -->
<script>
	// ADDED: Socket.io 클라이언트 연결 및 live 스트림 수신
	import { io } from 'socket.io-client';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	const backendUrl = import.meta.env.VITE_BACKEND_URL; // 기존 backendUrl 사용

	let liveStreams = [];
	let socket;

	onMount(() => {
		// 소켓 연결 (웹소켓 전용)
		socket = io(backendUrl, { transports: ['websocket'] });
		socket.on('liveStreams', (data) => {
			console.log('받은 라이브 스트림 데이터:', data);
			liveStreams = data;
		});
	});

	onDestroy(() => {
		if (socket) socket.disconnect();
	});

	function goToLiveSong(liveUser) {
		// ADDED: 라이브 카드 클릭 시 song 페이지로 이동, 쿼리 파라미터로 liveUser 정보 전달
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
		box-shadow: 0 2px 8px rgba(0,0,0,0.5);
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
