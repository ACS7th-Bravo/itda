<!-- /bravo-front/src/routes/podcast/+page.svelte -->
<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { liveUserParamStore } from '$lib/liveUserStore.js';  // 추가: 전역 스토어 임포트

	const backendUrl = import.meta.env.VITE_BACKEND_URL;
  
	let liveStreams = [];
  
	// 라이브 세션 정보를 백엔드 API (/api/live)에서 가져오는 함수
	async function fetchLiveSessions() {
	  try {
		const res = await fetch(`${backendUrl}/api/live`);
		if (res.ok) {
		  liveStreams = await res.json();
		  console.log('Fetched live sessions:', liveStreams);
		} else {
		  console.error('Failed to fetch live sessions');
		}
	  } catch (error) {
		console.error('Error fetching live sessions:', error);
	  }
	}
  
	let intervalId;
	onMount(() => {
	  fetchLiveSessions();
	  intervalId = setInterval(fetchLiveSessions, 10000);
	});
	onDestroy(() => {
	  clearInterval(intervalId);
	});
  
	function goToLiveSong(liveUser) {
	  if (liveUser && liveUser.email) {
		liveUserParamStore.set(liveUser.email);
		goto(`/song?liveUser=${liveUser.email}`);  // URL에 liveUser 값도 추가 (원하는 경우)
	  }
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
			  <!-- 수정: currentTrack -> track -->
			  <p>{stream.track.name} - {stream.track.artist}</p>
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
