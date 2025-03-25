<!-- /bravo-front/src/routes/playlistDetail/+page.svelte -->
<script>
	import { onMount } from 'svelte';
	import { writable, get } from 'svelte/store'; // get() 추가
	import { page } from '$app/stores'; // URL 접근을 위해 추가
	import { playTrack } from '$lib/trackPlayer.js';
	// 추가: 전역 재생 큐 컨텍스트 가져오기
	import { getContext } from 'svelte'; /* 수정: 전역 재생 큐 업데이트를 위해 추가 */
	import { goto } from '$app/navigation';
	const currentQueue = getContext('currentQueue'); /* 수정: 전역 재생 큐 컨텍스트 가져옴 */

	const backendUrl = import.meta.env.VITE_BACKEND_URL;

	// 플레이리스트 상세 정보를 저장할 스토어와 에러 메시지 스토어 생성
	let playlistDetail = writable(null);
	let errorMessage = writable('');

	// === NEW ADDITIONS START: 플레이리스트 제목 수정 관련 변수 추가 ===
	let isEditingTitle = false;
	let newTitle = "";
	// === NEW ADDITIONS END ===

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

			// === NEW ADDITIONS START: 제목 수정 시 기본값 설정 ===
			newTitle = data.name;
			// === NEW ADDITIONS END ===

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


	// === NEW ADDITIONS START: 공유하기 기능 관련 변수 및 함수 추가 ===
	let showShareForm = false;
	let shareEmail = '';
	let shareError = '';

	async function sharePlaylist() {
		if (!shareEmail) {
			shareError = '이메일을 입력해주세요.';
			return;
		}
		try {
			const res = await fetch(`${backendUrl}/api/playlist/share`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'ngrok-skip-browser-warning': '69420'
				},
				body: JSON.stringify({
					originalPlaylistId: get(playlistDetail)?._id,
					recipientEmail: shareEmail.trim().toLowerCase()  // <== 수정된 부분: 입력값 정규화
				})
			});
			const data = await res.json();
			if (!res.ok) {
				shareError = data.error || '공유에 실패했습니다.';
			} else {
				showShareForm = false;
				shareError = '';
				alert('플레이리스트 공유 성공!');
			}
		} catch (error) {
			shareError = error.message;
		}
	}
	// === NEW ADDITIONS END ===

	// === NEW ADDITIONS START: 플레이리스트 제목 변경 기능 ===
	async function updatePlaylistTitle() {
		const id = get(playlistDetail)?._id;
		if (!id) return;
		try {
			const res = await fetch(`${backendUrl}/api/playlist/${id}/title`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					'ngrok-skip-browser-warning': '69420'
				},
				body: JSON.stringify({ newTitle })
			});
			const data = await res.json();
			if (!res.ok) {
				alert(data.error || '제목 변경 실패');
			} else {
				playlistDetail.set(data);
				isEditingTitle = false;
				alert('플레이리스트 제목이 변경되었습니다.');
			}
		} catch (error) {
			alert(error.message);
		}
	}
	// === NEW ADDITIONS END ===

	// === NEW ADDITIONS START: 플레이리스트 삭제 기능 ===
	async function deletePlaylist() {
		const id = get(playlistDetail)?._id;
		if (!id) return;
		if (!confirm("플레이리스트를 정말 삭제하시겠습니까?")) return;
		try {
			const res = await fetch(`${backendUrl}/api/playlist/${id}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'ngrok-skip-browser-warning': '69420'
				}
			});
			if (!res.ok) {
				const data = await res.json();
				alert(data.error || '플레이리스트 삭제 실패');
			} else {
				alert('플레이리스트가 삭제되었습니다.');
				// 삭제 후 플레이리스트 매니저 페이지로 이동
				goto('/playlistManager');
			}
		} catch (error) {
			alert(error.message);
		}
	}
	// === NEW ADDITIONS END ===

	// === NEW ADDITIONS START: 플레이리스트에서 특정 트랙 삭제 기능 ===
	async function deleteTrack(trackId) {
		const id = get(playlistDetail)?._id;
		if (!id) return;
		if (!confirm("해당 트랙을 플레이리스트에서 삭제하시겠습니까?")) return;
		try {
			const res = await fetch(`${backendUrl}/api/playlist/${id}/remove-track`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					'ngrok-skip-browser-warning': '69420'
				},
				body: JSON.stringify({ trackId })
			});
			const data = await res.json();
			if (!res.ok) {
				alert(data.error || '트랙 삭제 실패');
			} else {
				playlistDetail.set(data);
				alert('트랙이 삭제되었습니다.');
			}
		} catch (error) {
			alert(error.message);
		}
	}
	// === NEW ADDITIONS END ===
</script>

{#if $errorMessage}
	<div class="error">{$errorMessage}</div>
{:else if $playlistDetail}
	<div class="playlist-detail-container">
		<!-- 제목 영역: 편집 모드에 따라 입력 필드 또는 텍스트로 표시 -->
		{#if isEditingTitle}
			<input type="text" bind:value={newTitle} />
			<button class="default-btn" on:click={updatePlaylistTitle}>저장</button>
			<button class="default-btn" on:click={() => { isEditingTitle = false; newTitle = $playlistDetail.name; }}>취소</button>
		{:else}
			<h1>{$playlistDetail.name}</h1>
			<button class="default-btn" on:click={() => { isEditingTitle = true; newTitle = $playlistDetail.name; }}>제목 변경</button>
		{/if}
		<!-- 플레이리스트 삭제 버튼 -->
		<button class="default-btn" on:click={deletePlaylist}>플레이리스트 삭제</button>
		<!-- === NEW ADDITIONS START: 공유하기 버튼 및 입력폼 추가 === -->
		<button class="default-btn" on:click={() => showShareForm = true}>공유하기</button>
		{#if showShareForm}
			<div class="share-form">
				<p>플레이리스트를 받을 이메일을 선택하시오</p>
				<input type="email" bind:value={shareEmail} placeholder="이메일 입력" />
				<button class="default-btn" on:click={sharePlaylist}>보내기</button>
				<button class="default-btn" on:click={() => showShareForm = false}>취소</button>
				{#if shareError}
					<div class="error">{shareError}</div>
				{/if}
			</div>
		{/if}
		<!-- === NEW ADDITIONS END === -->
		<ul class="track-list">
			{#each $playlistDetail.tracks as track, index}
				<li class="track-item">
					<img src={track.album_image} alt={track.track_name} class="track-thumbnail" />
					<div class="track-info">
						<strong>{track.track_name}</strong>
						<p>{track.artist_name}</p>
					</div>
					<!-- === NEW ADDITIONS START: 각 트랙 삭제 버튼 추가 (재생 버튼 왼쪽) === -->
					<button class="delete-btn" on:click={() => deleteTrack(track.track_id)}>-</button>
					<!-- === NEW ADDITIONS END === -->
					<button class="play-btn"on:click={() => playTrackFromDetail(track, index)}>▶</button>
				</li>
			{/each}
	</div>
{:else}
	<div class="loading">플레이리스트 정보를 불러오는 중...</div>
{/if}

<style>
	.playlist-detail-container {
		max-width: 100%;
		padding: 20px;
		color: white;
		text-align: left;
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
	.default-btn {
		background-color: #1db954;
		border: none;
		color: white;
		padding: 8px 12px;
		border-radius: 4px;
		cursor: pointer;
	}
	.default-btn:hover {
		background-color: #2784cc;
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
	/* === NEW ADDITIONS START: 공유하기 폼 스타일 추가 === */
	.share-form {
		margin: 10px 0;
		padding: 10px;
		background-color: #333;
		border-radius: 5px;
		text-align: center;
	}
	.share-form input {
		padding: 8px;
		margin: 5px;
		border-radius: 4px;
		border: 1px solid #ccc;
	}
	/* === NEW ADDITIONS END === */

	.delete-btn {
		margin-left: auto;
		background: none;
		border: none;
		font-size: 40px;
		font-weight: bold;
		cursor: pointer;
		color: rgb(255, 255, 255);
	}

	.delete-btn:hover {
		color: rgb(0, 255, 60);
	}

	.play-btn {
		margin-left: auto;
		background: none;
		border: none;
		font-size: 20px;
		font-weight: bold;
		cursor: pointer;
		color: rgb(255, 255, 255);
	}

	.play-btn:hover {
		color: rgb(0, 255, 60);
	}
</style>
