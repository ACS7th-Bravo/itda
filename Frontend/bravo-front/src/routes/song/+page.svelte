<!-- /bravo-front/src/routes/song/+page.svelte -->

<script>
	import { getContext, onMount, tick, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import Lyrics from './lyrics/+page.svelte';
	import ColorThief from 'colorthief'; // ==== Added: ColorThief import


	const backendUrl = import.meta.env.VITE_BACKEND_URL;
	let currentTrack = getContext('currentTrack');
	let showLyrics = getContext('lyricsExpanded');

	function toggleLyrics() {
		showLyrics.update((n) => !n);
	}

	let isBackgroundLoaded = writable(true);
	let backgroundImage = writable($currentTrack.albumImage);
	let previousBackgroundImage = writable($currentTrack.albumImage);

	$: {
		if ($currentTrack.albumImage && $backgroundImage !== $currentTrack.albumImage) {
			fadeBackground();
		}
	}
	async function fadeBackground() {
		isBackgroundLoaded.set(false);
		previousBackgroundImage.set($backgroundImage);
		await tick();
		setTimeout(() => {
			backgroundImage.set($currentTrack.albumImage);
			isBackgroundLoaded.set(true);
		}, 300);
	}

	let headerScale = writable(1);
	let headerTranslateY = writable(0);
	const maxScroll = 150;
	let songPage;
	let headerContainer;
	let lyricsComponent;

	// 부모에서 자식의 상태를 관리할 로컬 변수들
	let childIsTranslating = false;
	let childRefining = false;

	function handleUpdate(event) {
		// 자식 컴포넌트에서 보내는 상태 업데이트 이벤트 수신
		childIsTranslating = event.detail.isTranslating;
		childRefining = event.detail.refining;
	}

	function handleScroll() {
		const scrollTop = songPage ? songPage.scrollTop : 0;
		if (scrollTop < maxScroll) {
			const scale = 1 - (scrollTop / maxScroll) * 0.3;
			headerScale.set(scale);
			headerTranslateY.set(-scrollTop);
		} else {
			headerScale.set(0.5);
			headerTranslateY.set(-maxScroll);
		}
	}

	onMount(() => {
		if (songPage) {
			songPage.addEventListener('scroll', handleScroll);
		}
		return () => {
			if (songPage) songPage.removeEventListener('scroll', handleScroll);
		};
	});

	/* --- 추가된 부분: 번역 보정 인디케이터 애니메이션 --- */
	let indicatorCycle = ['번역 보정 진행중.', '번역 보정 진행중..', '번역 보정 진행중...'];
	let indicatorText = indicatorCycle[0];
	let currentCycleIndex = 0;
	let intervalId = null;

	$: {
		if (childRefining) {
			if (!intervalId) {
				intervalId = setInterval(() => {
					currentCycleIndex = (currentCycleIndex + 1) % indicatorCycle.length;
					indicatorText = indicatorCycle[currentCycleIndex];
				}, 500);
			}
		} else {
			if (intervalId) {
				clearInterval(intervalId);
				intervalId = null;
				indicatorText = indicatorCycle[0];
			}
		}
	}

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
	});
	/* --- 추가된 부분 끝 --- */

	// ==== Added: highlightColor store and album image element reference ====
// export const highlightColor = writable('rgb(29, 185, 84)'); // 전역 가사 하이라이트 기본 색상
// 	let albumImageEl; // 앨범 이미지 요소 참조

	// 앨범 이미지가 로드될 때 Color Thief로 색상 추출 후 highlightColor 업데이트
	// 1전 이건 대표색
	// function updateHighlightColor() {
	// 	if (albumImageEl) {
	// 		const colorThief = new ColorThief();
	// 		// 주의: 이미지가 same-origin이거나 CORS가 허용되어야 합니다.
	// 		const color = colorThief.getColor(albumImageEl);
	// 		highlightColor.set(`rgb(${color})`);
	// 	}
	// }

	// 2번(단순 보색)
// 	function updateHighlightColor() { //보색
// 	if (albumImageEl) {
// 		const colorThief = new ColorThief();
// 		const color = colorThief.getColor(albumImageEl); // 예: [r, g, b]
// 		// 보색 계산: 각 채널에서 255를 뺌
// 		const compColor = color.map((c) => 255 - c);
// 		highlightColor.set(`rgb(${compColor})`);
// 	}
// }


// //3번 (Hue 180도 회전시킨 색_어두운 배경은 어둡게 나와서 불편)
// 	// ==== Added: Helper functions for RGB ↔ HSL conversion ====
// 	function rgbToHsl(r, g, b) {
// 		r /= 255; g /= 255; b /= 255;
// 		let max = Math.max(r, g, b), min = Math.min(r, g, b);
// 		let h, s, l = (max + min) / 2;
// 		if (max === min) {
// 			h = s = 0; // 무채색
// 		} else {
// 			const d = max - min;
// 			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
// 			switch (max) {
// 				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
// 				case g: h = (b - r) / d + 2; break;
// 				case b: h = (r - g) / d + 4; break;
// 			}
// 			h /= 6;
// 		}
// 		return [h * 360, s, l]; // h: 0~360, s,l: 0~1
// 	}

// 	function hslToRgb(h, s, l) {
// 		h /= 360;
// 		let r, g, b;
// 		if (s === 0) {
// 			r = g = b = l;
// 		} else {
// 			const hue2rgb = (p, q, t) => {
// 				if(t < 0) t += 1;
// 				if(t > 1) t -= 1;
// 				if(t < 1/6) return p + (q - p) * 6 * t;
// 				if(t < 1/2) return q;
// 				if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
// 				return p;
// 			};
// 			const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
// 			const p = 2 * l - q;
// 			r = hue2rgb(p, q, h + 1/3);
// 			g = hue2rgb(p, q, h);
// 			b = hue2rgb(p, q, h - 1/3);
// 		}
// 		return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
// 	}
// 	// ==== End Added ====

// 	// ==== Modified: updateHighlightColor 함수 변경 (보색 계산 via HSL) ====
// 	// 기존 대표색 계산 코드를 보색 계산으로 변경합니다.
// 	function updateHighlightColor() {
// 		if (albumImageEl) {
// 			const colorThief = new ColorThief();
// 			const color = colorThief.getColor(albumImageEl); // 예: [r, g, b]
// 			// 1. RGB를 HSL로 변환
// 			let [h, s, l] = rgbToHsl(...color);
// 			// 2. Hue를 180도 이동하여 보색 계산 (회전)
// 			h = (h + 180) % 360;
// 			// 3. 채도가 낮은 경우 대비를 위해 채도를 인위적으로 높임 (예: s < 0.5이면 0.7로 보정)
// 			if (s < 0.5) {
// 				s = 0.7;
// 			}
// 			// 4. HSL을 다시 RGB로 변환
// 			const compColor = hslToRgb(h, s, l);
// 			highlightColor.set(`rgb(${compColor})`);
// 		}
// 	}


// 4번 (명도까지 조절한거)
// ==== Added: Helper functions for RGB ↔ HSL conversion ====
// function rgbToHsl(r, g, b) {
// 	r /= 255; g /= 255; b /= 255;
// 	let max = Math.max(r, g, b), min = Math.min(r, g, b);
// 	let h, s, l = (max + min) / 2;
// 	if (max === min) {
// 		h = s = 0; // 무채색
// 	} else {
// 		const d = max - min;
// 		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
// 		switch (max) {
// 			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
// 			case g: h = (b - r) / d + 2; break;
// 			case b: h = (r - g) / d + 4; break;
// 		}
// 		h /= 6;
// 	}
// 	return [h * 360, s, l]; // h: 0~360, s,l: 0~1
// }

// function hslToRgb(h, s, l) {
// 	h /= 360;
// 	let r, g, b;
// 	if (s === 0) {
// 		r = g = b = l;
// 	} else {
// 		const hue2rgb = (p, q, t) => {
// 			if (t < 0) t += 1;
// 			if (t > 1) t -= 1;
// 			if (t < 1/6) return p + (q - p) * 6 * t;
// 			if (t < 1/2) return q;
// 			if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
// 			return p;
// 		};
// 		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
// 		const p = 2 * l - q;
// 		r = hue2rgb(p, q, h + 1/3);
// 		g = hue2rgb(p, q, h);
// 		b = hue2rgb(p, q, h - 1/3);
// 	}
// 	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
// }
// // ==== End Added ====

	
// // ==== Modified: updateHighlightColor 함수 변경 (보색 계산 via HSL + 명도 보정) ====
// // 기존 대표색 계산 코드를 보색 계산으로 변경한 후, 명도가 낮을 경우 보정합니다.
// function updateHighlightColor() {
// 	if (albumImageEl) {
// 		const colorThief = new ColorThief();
// 		const color = colorThief.getColor(albumImageEl); // 예: [r, g, b]
// 		// 1. RGB를 HSL로 변환
// 		let [h, s, l] = rgbToHsl(...color);
// 		// 2. Hue를 180도 이동하여 보색 계산 (회전)
// 		h = (h + 180) % 360;
// 		// 3. 채도가 낮은 경우 대비를 위해 채도를 인위적으로 높임 (예: s < 0.5이면 0.7로 보정)
// 		if (s < 0.5) {
// 			s = 0.7;
// 		}
// 		// 4. ==== Modified: 명도가 낮은 경우 보정을 추가 (예: l < 0.7이면 0.7로 보정) ====
// 		if (l < 0.7) {
// 			l = 0.7;
// 		}
// 		// 5. HSL을 다시 RGB로 변환
// 		const compColor = hslToRgb(h, s, l);
// 		highlightColor.set(`rgb(${compColor})`);
// 	}
// }

// 	onMount(() => {
// 		if (albumImageEl) {
// 			if (albumImageEl.complete) {
// 				updateHighlightColor();
// 			} else {
// 				albumImageEl.addEventListener('load', updateHighlightColor);
// 			}
// 		}
// 	});

// 	// ==== Added: reactive statement로 전역 CSS 변수 업데이트 ====
// 	$: document.documentElement.style.setProperty("--highlight-color", $highlightColor);
// 	// ==== End Added ====


</script>

<!-- Song 페이지 컨테이너 -->
<div
	class="song-page"
	bind:this={songPage}
	style="height: {$showLyrics ? 'auto' : '100vh'}; overflow: {$showLyrics ? 'auto' : 'hidden'};"
>
	<!-- 배경 이미지 (페이드 아웃) -->
	<div
		class="background-image previous"
		style="background-image: url({$previousBackgroundImage}); opacity: {$isBackgroundLoaded
			? 0
			: 1};"
	></div>
	<!-- 배경 이미지 (페이드 인) -->
	<div
		class="background-image"
		style="background-image: url({$backgroundImage}); opacity: {$isBackgroundLoaded ? 1 : 0};"
	></div>

	<!-- 헤더 컨테이너 -->
	<div
		class="header-container"
		bind:this={headerContainer}
		style="transform: scale({$headerScale}) translateY({$headerTranslateY}px);"
	>
	<!-- <img crossOrigin="anonymous" bind:this={albumImageEl} src={$currentTrack.albumImage} alt="Album Cover" class="song-image" /> -->
	<img src={$currentTrack.albumImage} alt="Album Cover" class="song-image" />
	
	<h1 class="song-title">{$currentTrack.name}</h1>
		<p class="song-artist">{$currentTrack.artist}</p>

		<!-- ===== [변경된 부분] =====
				버튼들을 그룹으로 묶고, 번역 인디케이터는 버튼 그룹 아래에 위치하도록 함
	 -->
		<div class="button-group">
			<button class="lyrics-toggle" on:click={toggleLyrics}>
				{#if $showLyrics}
					▲ 가사 접기
				{:else}
					▼ 가사 보기
				{/if}
			</button>
			<button
				on:click={() => lyricsComponent.requestTranslation()}
				class="translate-button"
				disabled={childIsTranslating}
			>
				{#if childIsTranslating}
					번역 중...
				{:else}
					번역 요청
				{/if}
			</button>
		</div>
		{#if childRefining}
			<div class="indicator-container">
				<span class="refining-indicator">{indicatorText}</span>
			</div>
		{/if}
		<!-- ===== [변경된 부분 끝] ===== -->
	</div>

	<!-- 가사 컴포넌트 -->
	<div class="lyrics-wrapper {$showLyrics ? 'show' : ''}">
		<Lyrics bind:this={lyricsComponent} on:update={handleUpdate} />
	</div>
</div>

<!-- /bravo-front/src/routes/song/+page.svelte -->

<style>
	*::-webkit-scrollbar {
		display: none;
	}
	* {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.song-page {
		position: relative;
		padding: 20px 0 60px;
		color: white;
		text-align: center;
		z-index: 0;
		box-sizing: border-box;
	}
	.background-image {
		position: fixed;
		top: 0;
		left: 250px;
		width: calc(100% - 250px);
		height: 100vh;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		transition: opacity 1s ease-in-out;
		z-index: -100;
	}
	.song-page::before {
		content: '';
		position: fixed;
		top: 0;
		left: 250px;
		width: calc(100% - 250px);
		height: 100vh;
		background: rgba(0, 0, 0, 0.5);
		z-index: -50;
	}
	.header-container {
		position: sticky;
		top: 60px;
		z-index: 10;
		padding: 20px;
		transition: transform 0.2s ease-out;
		transform-origin: top center;
	}
	.song-image {
		width: 30%;
		max-width: 400px;
		border-radius: 10px;
		margin-bottom: 10px;
		box-shadow: 0 0 20px rgba(255, 255, 255, 0.6);
		animation: pulseShadow 10s infinite ease-in-out; /* ==== Modified: 애니메이션 지속 시간을 20초로 늘림 ==== */
}

/* ==== Modified: pulseShadow keyframes (2배 더 부드럽게) ==== */
@keyframes pulseShadow {
	0% {
		box-shadow: 0 0 20px rgba(255, 255, 255, 0.6);
	}
	12.5% {
		box-shadow: 0 0 22px rgba(255, 255, 255, 0.63);
	}
	25% {
		box-shadow: 0 0 25px rgba(255, 255, 255, 0.7);
	}
	37.5% {
		box-shadow: 0 0 27px rgba(255, 255, 255, 0.73);
	}
	50% {
		box-shadow: 0 0 30px rgba(255, 255, 255, 0.8);
	}
	62.5% {
		box-shadow: 0 0 27px rgba(255, 255, 255, 0.73);
	}
	75% {
		box-shadow: 0 0 25px rgba(255, 255, 255, 0.7);
	}
	87.5% {
		box-shadow: 0 0 22px rgba(255, 255, 255, 0.63);
	}
	100% {
		box-shadow: 0 0 20px rgba(255, 255, 255, 0.6);
	}
	}
	.song-title {
		font-size: 40px;
		font-weight: bold;
		margin: 0;
	}
	.song-artist {
		font-size: 24px;
		color: #bbb;
		margin: 0;
	}
	/* --- 변경된 부분: 버튼 그룹 및 인디케이터 컨테이너 스타일 --- */
	.button-group {
		display: inline-flex;
		gap: 10px;
		margin-top: 10px;
	}
	.lyrics-toggle {
		background: #1db954;
		color: white;
		border: none;
		padding: 12px 20px;
		font-size: 16px;
		border-radius: 5px;
		cursor: pointer;
		transition: background 0.3s;
		position: relative;
		z-index: 10;
	}
	.lyrics-toggle:hover {
		background: #1a954b;
	}
	.translate-button {
		padding: 12px 20px;
		font-size: 16px;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		background-color: #1db954;
		color: white;
		transition: background-color 0.3s;
	}
	.translate-button:hover {
		background-color: #17a44d;
	}
	.indicator-container {
		margin-top: 5px;
	}
	.refining-indicator {
		font-size: 25px;
		color: #ffc107;
	}
	/* ----------------------------------------------------------------- */
	.lyrics-wrapper {
		width: 80%;
		margin: 0 auto;
		padding: 0;
		color: white;
		border-radius: 10px;
		text-align: center;
		opacity: 0;
		max-height: 0;
		overflow: hidden;
		transition:
			max-height 0.5s ease-in-out,
			opacity 0.5s ease-in-out,
			padding 0.5s ease-in-out,
			margin 0.5s ease-in-out;
		position: relative;
		z-index: 5;
	}
	.lyrics-wrapper.show {
		opacity: 1;
		max-height: fit-content;
		margin: 20px auto 0;
		padding: 20px;
		text-align: center;
	}
</style>