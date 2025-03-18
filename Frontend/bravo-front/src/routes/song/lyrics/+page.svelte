<script>
	import { getContext, onMount, onDestroy, tick, createEventDispatcher } from 'svelte';
	import { writable } from 'svelte/store';

	const currentTrack = getContext('currentTrack');
	const showLyrics = getContext('lyricsExpanded');
	const currentTimeStore = getContext('currentTime');

	let currentTimeVal = 0;
	currentTimeStore.subscribe((value) => {
		currentTimeVal = value;
	});

	let lyrics = '가사를 불러오는 중...';
	let translatedLyrics = '';
	let isTranslating = false;
	let refining = false;
	let parsedLyrics = null;

	// 자동 스크롤 제어
	let autoScrollPaused = false;
	let autoScrollPauseTimeout;

	// trackKey는 캐싱 키 정도로 사용 가능
	$: trackKey =
		$currentTrack && $currentTrack.name ? `${$currentTrack.name}-${$currentTrack.artist}` : '';

		$: originalLines = typeof lyrics === 'string' ? lyrics.split('\n') : [];
$: translatedLines = typeof translatedLyrics === 'string' ? translatedLyrics.split('\n') : [];

	function convertTimeToSeconds(timeStr) {
		// "mm:ss.xx" 형태를 [분, 초, 소수점(백분단위)]로 파싱
		const parts = timeStr.split(':');
		if (parts.length === 2) {
			const [mm, rest] = parts;
			const [ss, ms = 0] = rest.split('.') || [];
			const minutes = parseInt(mm, 10) || 0;
			const seconds = parseInt(ss, 10) || 0;
			const hundredths = parseInt(ms, 10) || 0;
			return minutes * 60 + seconds + hundredths / 100;
		}
		return 0;
	}

	let activeLineIndex = -1;

	$: if (parsedLyrics) {
		activeLineIndex = -1;
		for (let i = 0; i < parsedLyrics.length; i++) {
			const lineTime = convertTimeToSeconds(parsedLyrics[i].time);
			if (currentTimeVal >= lineTime) {
				activeLineIndex = i;
			} else {
				break;
			}
		}
	}

	$: if (parsedLyrics && activeLineIndex !== -1 && !autoScrollPaused) {
		requestAnimationFrame(() => {
			const currentLine = parsedLyrics[activeLineIndex];
			const lineTime = convertTimeToSeconds(currentLine.time);
			if (lineTime <= currentTimeVal) {
				const el = lyricsContainer.querySelector(`.lyrics-content[data-line-time="${lineTime}"]`);
				if (el) {
					el.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
			}
		});
	}

	const backendUrl = import.meta.env.VITE_BACKEND_URL;

	async function fetchLyrics(song, artist, englishTrackName, englishArtistName) {
		const trackId = $currentTrack?.track_id || '';

		try {
			const res = await fetch(
				`${backendUrl}/api/lyrics?` +
					new URLSearchParams({
						track_id: trackId,
						song,
						artist,
						englishTrackName: englishTrackName || '',
						englishArtistName: englishArtistName || ''
					}),
				{
					headers: {
						'Content-Type': 'application/json',
						'ngrok-skip-browser-warning': '69420'
					}
				}
			);
			const data = await res.json();

			if (data.lyrics) {
				lyrics = data.lyrics;
				if (data.parsedLyrics) {
					parsedLyrics = data.parsedLyrics;
				}
			} else {
				lyrics = '가사를 찾을 수 없습니다.';
				parsedLyrics = null;
			}
		} catch (error) {
			console.error('가사 fetch 실패:', error);
			lyrics = '가사를 불러오는데 실패했습니다.';
			parsedLyrics = null;
		}
	}

	const dispatch = createEventDispatcher();

	async function requestTranslation() {
		if (translatedLyrics) {
			// 이미 번역되어 있다면 다시 누를 시 번역 해제
			translatedLyrics = '';
			dispatch('update', { isTranslating, refining });
			return;
		}

		if (lyrics) {
			isTranslating = true;
			dispatch('update', { isTranslating, refining });

			try {
				const response = await fetch(`${backendUrl}/api/translate`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'ngrok-skip-browser-warning': '69420'
					},
					body: JSON.stringify({
						lyrics,
						track_id: $currentTrack.track_id || ''
					})
				});
				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let done = false;

				while (!done) {
					const { value, done: doneReading } = await reader.read();
					done = doneReading;

					const chunk = decoder.decode(value);
					const lines = chunk.split('\n').filter((line) => line.trim() !== '');

					for (const line of lines) {
						if (line.startsWith('data: ')) {
							const jsonStr = line.slice(6);
							const data = JSON.parse(jsonStr);

							if (data.stage === 'amazon') {
								translatedLyrics = data.translation;
							} else if (data.stage === 'update') {
								refining = true;
							} else if (data.stage === 'refined') {
								if (data.translation === lyrics) {
									translatedLyrics = '';
								} else {
									translatedLyrics = data.translation;
								}
								refining = false;
							} else if (data.stage === 'error') {
								translatedLyrics = data.message;
							}

							dispatch('update', { isTranslating, refining });
							await tick();
						}
					}
				}
			} catch (error) {
				console.error('번역 요청 실패:', error);
				translatedLyrics = '번역 요청 실패';
			} finally {
				isTranslating = false;
				dispatch('update', { isTranslating, refining });
			}
		}
	}

	let previousTrackId = null;

	// ✅ 구독 해제용 변수
	let unsubscribe = null;

	onMount(() => {
		// Svelte store 구독 설정
		unsubscribe = currentTrack.subscribe((track) => {
			if (!track || !track.track_id) return;

			const newTrackId = track.track_id;
			if (previousTrackId && previousTrackId !== newTrackId) {
				// 다른 곡으로 바뀔 때 기존 가사/번역 초기화
				showLyrics.set(false);
				lyrics = '';
				translatedLyrics = '';
				isTranslating = false;
				refining = false;
			}
			previousTrackId = newTrackId;

			// 새 곡 정보에 맞춰 가사 fetch
			fetchLyrics(track.name, track.artist, track.englishTrackName, track.englishArtistName);
		});
	});

	onDestroy(() => {
		// ✅ 컴포넌트가 언마운트될 때 구독 해제
		if (unsubscribe) {
			unsubscribe();
		}
	});

	// 자동 스크롤 중단
	function pauseAutoScroll() {
		autoScrollPaused = true;
		if (autoScrollPauseTimeout) {
			clearTimeout(autoScrollPauseTimeout);
		}
		autoScrollPauseTimeout = setTimeout(() => {
			autoScrollPaused = false;
		}, 3000);
	}

	let lyricsContainer;
	const fadeStart = 320;
	const fadeEnd = 475;

	function updateParagraphOpacity() {
		if (!lyricsContainer) return;
		const paragraphs = lyricsContainer.querySelectorAll('.lyrics-content');
		paragraphs.forEach((p) => {
			const rect = p.getBoundingClientRect();
			let opacity;
			if (rect.top <= fadeStart) {
				opacity = 0;
			} else if (rect.top >= fadeEnd) {
				opacity = 1;
			} else {
				opacity = (rect.top - fadeStart) / (fadeEnd - fadeStart);
			}
			p.style.opacity = opacity;
		});
	}

	// page scroll / lyricsContainer scroll 이벤트
	onMount(() => {
		const songPage = document.querySelector('.song-page');
		const handleUserScroll = () => {
			pauseAutoScroll();
			updateParagraphOpacity();
		};

		if (songPage) {
			songPage.addEventListener('scroll', handleUserScroll);
		}
		if (lyricsContainer) {
			lyricsContainer.addEventListener('scroll', handleUserScroll);
		}

		// 초기 한 번
		updateParagraphOpacity();

		return () => {
			if (songPage) {
				songPage.removeEventListener('scroll', handleUserScroll);
			}
			if (lyricsContainer) {
				lyricsContainer.removeEventListener('scroll', handleUserScroll);
			}
		};
	});

	export { requestTranslation };
</script>

<!-- 가사 영역 그치치-->
<div class="lyrics-container" bind:this={lyricsContainer}>
	{#if parsedLyrics}
		{#each parsedLyrics as line, i}
			<div class="line-pair">
				<p
					class="lyrics-content original {i === activeLineIndex ? 'highlight' : ''}"
					data-line-time={convertTimeToSeconds(line.time)}
				>
					{line.text}
				</p>
				{#if translatedLines[i]}
					<p
						class="lyrics-content translated-lyrics {i === activeLineIndex ? 'highlight' : ''}"
						data-line-time={convertTimeToSeconds(line.time)}
					>
						{translatedLines[i]}
					</p>
				{/if}
			</div>
		{/each}
	{:else if originalLines.length > 0}
		{#each originalLines as line, i}
			<div class="line-pair">
				<p class="lyrics-content original">{line}</p>
				{#if translatedLines[i]}
					<p class="lyrics-content translated-lyrics">{translatedLines[i]}</p>
				{/if}
			</div>
		{/each}
	{:else}
		<p class="lyrics-content">{lyrics}</p>
	{/if}
</div>

<style>
	.highlight {
		/* color: var(--highlight-color, #1db954); */
		color: #1db954;
		font-size: 1.4rem;
		/* color: white; */
		font-weight: bold;
		/* background: rgba(255, 255, 255, 0.3); */
		/* padding: 0.2em 0.4em; */
		transition: background 0.3s ease, color 0.3s ease;
	}

	.lyrics-container {
		width: 100%;
		max-width: 900px;
		padding: 20px;
		border-radius: 10px;
		margin: 20px auto 0;
		color: white;
		/* color: var(--highlight-color, #1db954); */
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
	}

	.lyrics-content {
		white-space: pre-line;
		font-size: 1.3rem;
		transition: opacity 0.3s ease;
	}

	.line-pair {
		margin-bottom: 1px;
	}
	.line-pair .original {
		margin-bottom: 2px;
	}
	.translated-lyrics {
		text-decoration: underline;
		text-decoration-color: #17a44d;
		text-decoration-thickness: 2px;
	}

	/* .translated-lyrics {
		text-decoration: underline;
		text-decoration-color: var(--highlight-color, #1db954);
		text-decoration-thickness: 2px;
	} */
</style>