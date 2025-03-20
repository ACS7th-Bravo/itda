<!-- /bravo-front/src/routes/+layout.svelte -->

<script>
	import { fly } from 'svelte/transition';
	import { onMount, setContext } from 'svelte'; //2025.02.14 DB 이메일 추출출, onmount랑 합침침
	import { writable, get } from 'svelte/store';
	import { page } from '$app/stores'; 
	// import { youtubeApiKey } from '$lib/youtubeStore.js';
	import { searchResults } from '$lib/searchStore.js'; 
	import { playTrack } from '$lib/trackPlayer.js';
	import { goto } from '$app/navigation'; //곡 상세페이지로 넘어가는 함수
	import { jwtDecode } from 'jwt-decode';
	import { playlistManager } from '$lib/playlistManagerStore.js';
	import { playlist } from '$lib/playlistStore.js';
 
 
	//MSA
	const backendUrl = import.meta.env.VITE_BACKEND_URL
 
	// 로그인 상태 및 사용자 정보
	let isLoggedIn = false;
	let user = { email: '', picture: '' }; //2025.02.14 DB 이메일 추출
 
 
	console.log('백엔드 URL:', import.meta.env.VITE_BACKEND_URL);
 
 
	// 기본 볼륨 값을 50로 설정 (0 ~ 100)
	let volume = 50;
	let isPlaying = false;
	let youtubePlayer;
	let currentYouTubeVideoId = null;
	let currentTrackIndex = -1; // ✅ 현재 재생 중인 곡의 인덱스 추가
 
	// 로그아웃: 로컬 스토리지에서 토큰 삭제 후 메인 페이지 이동
	function logout() {
	   localStorage.removeItem('jwt_token');
	   isLoggedIn = false;
	   user = { email: '', name: '', picture: '' }; // 2025.02.14 플레이리스트트
	   window.location.href = '/';
	}
 
	// ✅ 현재 재생 중인 트랙 정보
	let currentTrack = writable({
	   name: 'IT-DA',
	   artist: 'Team-Bravo',
	   albumImage: '/logo2.png'
	});
 
	// ✅ Svelte context에 currentTrack 등록 (하위 페이지에서 사용 가능)
	setContext('currentTrack', currentTrack);
 
	// ===== [추가된 부분] =====
	// 글로벌 가사 펼침 상태 스토어를 생성하고 context에 등록합니다.
	let lyricsExpanded = writable(false); // *** NEW: 글로벌 가사 펼침 상태 스토어 추가 ***
	setContext('lyricsExpanded', lyricsExpanded); // *** NEW: context에 등록 ***
	// ==========================
 
	// NEW: 전역에서 현재 재생시간을 공유할 스토어 생성 및 context에 등록
	let currentTimeStore = writable(0); /* NEW: 전역 currentTimeStore 생성 */
	setContext('currentTime', currentTimeStore);
	// ==========================
 
	// [추가됨: 현재 재생 큐 저장 스토어]
	let currentQueueStore = writable([]); // 재생할 트랙들의 배열 (검색 또는 플레이리스트에 따라 달라짐)
	setContext('currentQueue', currentQueueStore); // 하위 페이지에서 사용 가능
 
	// ✅ 프로그레스 바 관련 변수
	let currentTime = 0;
	let duration = 0;
	let progress = 0;
	let interval = null;
 
	//플레이어 글씨 자동 넘김
	let scrollingSongNameElement;
	let isSongNameScrollable = false;
	let scrollingArtistElement;
	let isArtistScrollable = false;
 
	// currentTrack 변화에 반응하도록 (dummy 변수를 사용)
	$: {
	   // 현재 트랙의 변화에 의존하도록 dummy 변수를 사용
	   const dummy = $currentTrack.name + $currentTrack.artist;
	   setTimeout(() => {
		  if (scrollingSongNameElement) {
			 const distance =
				scrollingSongNameElement.scrollWidth - scrollingSongNameElement.clientWidth;
			 isSongNameScrollable = distance > 0;
			 if (isSongNameScrollable) {
				// 이동 시간(픽셀/초 속도 50px/s, 최소 5초)
				const moveTime = Math.max(distance / 50, 5);
				// 전체 애니메이션 시간 = 이동 시간 / 0.8 (즉, 80% 이동, 20% 정지)
				const totalDuration = moveTime / 0.8;
				scrollingSongNameElement.style.setProperty('--marquee-duration', `${totalDuration}s`);
				scrollingSongNameElement.style.setProperty('--overflow-distance', `${distance}px`);
				// 새로운 곡 재생 시 강제 재시작
				scrollingSongNameElement.classList.remove('scrollable');
				void scrollingSongNameElement.offsetWidth;
				scrollingSongNameElement.classList.add('scrollable');
			 }
		  }
		  if (scrollingArtistElement) {
			 const distance = scrollingArtistElement.scrollWidth - scrollingArtistElement.clientWidth;
			 isArtistScrollable = distance > 0;
			 if (isArtistScrollable) {
				const moveTime = Math.max(distance / 50, 5);
				const totalDuration = moveTime / 0.8;
				scrollingArtistElement.style.setProperty('--marquee-duration', `${totalDuration}s`);
				scrollingArtistElement.style.setProperty('--overflow-distance', `${distance}px`);
				scrollingArtistElement.classList.remove('scrollable');
				void scrollingArtistElement.offsetWidth;
				scrollingArtistElement.classList.add('scrollable');
			 }
		  }
	   }, 0);
	}
 
	// 별도의 재시작 플래그 선언
	let marqueeRestartingSong = false;
	let marqueeRestartingArtist = false;
 
	// 이름 있는 이벤트 핸들러들
	function handleSongNameAnimationEnd() {
	   // 애니메이션 종료 시 이벤트 리스너를 먼저 제거합니다.
	   scrollingSongNameElement.removeEventListener('animationend', handleSongNameAnimationEnd);
	   // 10초 대기 후 애니메이션을 재시작
	   setTimeout(() => {
		  scrollingSongNameElement.classList.remove('scrollable');
		  // 강제 reflow로 애니메이션 리셋
		  void scrollingSongNameElement.offsetWidth;
		  scrollingSongNameElement.classList.add('scrollable');
		  // 새로 애니메이션 종료 이벤트를 등록
		  scrollingSongNameElement.addEventListener('animationend', handleSongNameAnimationEnd);
	   }, 10000);
	}
 
	function handleArtistAnimationEnd() {
	   scrollingArtistElement.removeEventListener('animationend', handleArtistAnimationEnd);
	   setTimeout(() => {
		  scrollingArtistElement.classList.remove('scrollable');
		  void scrollingArtistElement.offsetWidth;
		  scrollingArtistElement.classList.add('scrollable');
		  scrollingArtistElement.addEventListener('animationend', handleArtistAnimationEnd);
	   }, 10000);
	}
 
	// ✅ 시간 포맷 변환 (초 → mm:ss)
	function formatTime(seconds) {
	   const min = Math.floor(seconds / 60);
	   const sec = Math.floor(seconds % 60);
	   return `${min}:${sec < 10 ? '0' : ''}${sec}`;
	}
 
	// 곡 상세페이지로 넘어가는 함수
	function navigateToSongPage() {
	   const currentPath = get(page).url.pathname;
	   if (currentPath === '/song') {
		  goto('/search');
	   } else {
		  goto('/song');
	   }
	}
 
	// ✅ 전역 플레이어에서 곡 재생
	// 준현 수정 - handlePlayTrack 부분 영문 이름 수정
	// ✅ 전역 플레이어에서 곡 재생
	function handlePlayTrack(event) {
	   const { videoId, track, index } = event.detail;
	   if (videoId) {
		  currentTrack.update((t) => ({
			 ...t,
			 track_id: track.id, // ← 추가: DB 업데이트에 사용될 track_id 저장
			 name: track.name,
			 artist: track.artist, // 이미 평탄화된 문자열 사용
			 albumImage: track.imageUrl || '/default-album.png',
			 englishTrackName: track.englishTrackName || track.name,
			 englishArtistName: track.englishArtistName || track.artist
		  }));
 
		  currentYouTubeVideoId = videoId;
		  currentTrackIndex = index;
 
		  // 백엔드에 트랙 정보 저장 요청 (검색 API에서 반환된 평탄화된 필드 사용)
		  fetch(`${backendUrl}/api/track`, {
			 method: 'POST',
			 headers: { 'Content-Type': 'application/json' },
			 body: JSON.stringify({
				track_id: track.id,
				track_name: track.name,
				artist_id: track.artist_id || 'unknown',
				artist_name: track.artist || '알 수 없음',
				album_id: track.album_id || 'unknown',
				album_image: track.imageUrl || '/default-album.png',
				streaming_id: videoId,
				plain_lyrics: null,
				parsed_lyrics: null,
				lyrics_translation: null
			 })
		  })
			 .then((res) => res.json())
			 .then((data) => {
				console.log('트랙 저장 결과:', data);
			 })
			 .catch((error) => {
				console.error('트랙 저장 중 오류 발생:', error);
			 });
 
		  // YouTube 플레이어 초기화 또는 업데이트
		  if (!youtubePlayer) {
			 youtubePlayer = new YT.Player('youtube-player', {
				height: '0',
				width: '0',
				videoId: videoId,
				playerVars: {
				   autoplay: 1,
				   controls: 0,
				   showinfo: 0,
				   modestbranding: 1,
				   loop: 0,
				   rel: 0
				},
				events: {
				   onReady: () => {
					  youtubePlayer.playVideo();
					  startProgressUpdate();
				   },
				   onStateChange: (event) => {
					  console.log('🎬 YouTube 플레이어 상태 변경:', event.data);
					  if (event.data === YT.PlayerState.ENDED) {
						 console.log('✅ 곡이 끝남! 다음 곡 자동 재생 시작...');
						 playNextTrack();
					  } else if (event.data === YT.PlayerState.PLAYING) {
						 console.log('▶️ 곡 재생 중...'); // [수정됨]
						 isPlaying = true;
						 startProgressUpdate();
					  } else if (event.data === YT.PlayerState.PAUSED) {
						 console.log('⏸️ 곡 일시 정지됨'); // [수정됨]
						 isPlaying = false;
					  } else {
						 console.log('⚠️ 알 수 없는 상태 코드:', event.data); // [수정됨]
						 clearInterval(interval);
					  }
				   }
				}
			 });
		  } else {
			 youtubePlayer.loadVideoById(videoId);
			 startProgressUpdate();
		  }
		  isPlaying = true;
	   }
	}
 
	// ✅ 다음 곡 자동 재생 함수
	async function playNextTrack() {
	   console.log('⏭️ playNextTrack() 호출됨!'); // [수정됨]
	   const queue = get(currentQueueStore);
	   const tracks = queue.length ? queue : $searchResults;
	   console.log('🔍 현재 검색된 트랙 목록:', tracks);
	   console.log('🎵 현재 트랙 인덱스:', currentTrackIndex);
	   if (currentTrackIndex < tracks.length - 1) {
		  const nextTrack = tracks[currentTrackIndex + 1];
		  console.log('✅ 다음 재생할 트랙:', nextTrack);
		  // ✅ 기존의 playTrack() 함수를 호출하여 자동 재생
		  playTrack(nextTrack, currentTrackIndex + 1);
	   } else {
		  console.log('⏹️ 더 이상 재생할 트랙이 없습니다.'); // [수정됨]
	   }
	}
 
	// 이전 곡 재생 함수 추가
	function playPreviousTrack() {
	   console.log('⏮️ playPreviousTrack() 호출됨!'); // [수정됨]
	   if (currentTime > 3) {
		  console.log('현재 재생시간이 3초 이상이므로, 현재 곡을 처음으로 되돌립니다.');
		  if (youtubePlayer && youtubePlayer.seekTo) {
			 youtubePlayer.seekTo(0, true);
		  }
	   } else {
		  const queue = get(currentQueueStore);
		  const tracks = queue.length ? queue : $searchResults;
		  console.log('현재 트랙 인덱스:', currentTrackIndex);
		  if (currentTrackIndex > 0) {
			 const prevTrack = tracks[currentTrackIndex - 1];
			 console.log('이전 재생할 트랙:', prevTrack);
			 playTrack(prevTrack, currentTrackIndex - 1);
		  } else {
			 console.log('이전 곡이 없습니다. 현재 곡을 처음으로 되돌립니다.');
			 if (youtubePlayer && youtubePlayer.seekTo) {
				youtubePlayer.seekTo(0, true);
			 }
		  }
	   }
	}
 
	// ✅ 현재 재생 시간을 업데이트하는 함수
	function startProgressUpdate() {
	   clearInterval(interval);
	   interval = setInterval(() => {
		  if (youtubePlayer && youtubePlayer.getCurrentTime) {
			 currentTime = youtubePlayer.getCurrentTime();
			 duration = youtubePlayer.getDuration();
			 progress = (currentTime / duration) * 100;
			 currentTimeStore.set(currentTime);
		  }
	   }, 500);
	}
 
	// ✅ 사용자가 슬라이더 이동 시 특정 위치로 이동
	function seekTrack(event) {
	   const newTime = (event.target.value / 100) * duration;
	   youtubePlayer.seekTo(newTime, true);
	}
 
	// ✅ 일시정지 / 재생 기능 유지
	function togglePause() {
	   if (youtubePlayer) {
		  if (isPlaying) {
			 youtubePlayer.pauseVideo();
		  } else {
			 youtubePlayer.playVideo();
		  }
		  isPlaying = !isPlaying;
	   }
	}
 
	// 볼륨 업데이트 함수: 슬라이더 값이 변경될 때 호출
	function updateVolume(event) {
	   const target = event.target;
	   volume = +target.value;
	   if (youtubePlayer) {
		  youtubePlayer.setVolume(volume);
	   }
	}
 
	// ✅ YouTube API 로드
	function loadYouTubeAPI() {
	   const script = document.createElement('script');
	   script.src = 'https://www.youtube.com/iframe_api';
	   script.async = true;
	   document.body.appendChild(script);
	}
 
	// === 변경된 부분: Socket.io 클라이언트 연결 (동적 임포트 사용) ===
	// === 변경된 부분: Socket.io 클라이언트 연결 (동적 임포트 사용) ===
 let socket;
 let currentRoomId = ''; // 현재 참여중인 roomId 저장 변수
let previousLiveStatus = 'off'; // 이전 라이브 상태 저장 변수
// ===== 추가된 부분 시작 =====
let previousTrackName = ''; // 이전 트랙 이름 저장 변수
let previousTrackArtist = ''; // 이전 아티스트 이름 저장 변수
let previousTrackId = ''; // 이전 트랙 ID 저장 변수
// ===== 추가된 부분 끝 =====
// ===== 추가된 부분 시작 =====
// 호스트가 새로 참여한 클라이언트에 대한 동기화 재시도 타이머
let syncRetryTimers = new Map(); // clientId -> timerID

// 최대 재시도 횟수 및 간격 (밀리초)
const MAX_SYNC_RETRY = 3;
const SYNC_RETRY_INTERVAL = 5000;

// 호스트인지 여부
let isLiveHost = false;

function handleLiveUserParam(liveUserParam) {
  if (liveUserParam && socket && socket.connected) {
    const roomId = liveUserParam.trim();
    console.log(`🔍 URL에서 liveUser 파라미터 감지: ${roomId}`);
    
    // 이미 같은 방에 참여중인 경우 재전송하지 않음
    if (roomId !== currentRoomId) {
      console.log(`🔗 클라이언트가 방 참여 요청: ${roomId}`);
      socket.emit('joinRoom', { roomId });
      console.log(`📤 joinRoom 이벤트 전송: ${roomId}`);
    } else {
      console.log(`⚠️ 이미 방 ${roomId}에 참여 중입니다.`);
    }
  }
}

///온마운트3 시작
onMount(async () => {
	console.log('Song 페이지 마운트됨, URL:', window.location.href);
  // 1. 토큰 관련 처리
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  if (tokenFromUrl) {
    localStorage.setItem('jwt_token', tokenFromUrl);
    isLoggedIn = true;
    try {
      const decoded = jwtDecode(tokenFromUrl);
      user = {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture
      };
      console.log('디코딩된 JWT:', decoded);
      setContext('currentUser', user);
    } catch (error) {
      console.error('JWT 디코딩 오류:', error);
    }
    window.history.replaceState({}, document.title, '/');
  } else {
    const savedToken = localStorage.getItem('jwt_token');
    if (savedToken) {
      isLoggedIn = true;
      try {
        const decoded = jwtDecode(savedToken);
        user = {
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture
        };
        console.log('디코딩된 JWT:', decoded);
        setContext('currentUser', user);
      } catch (error) {
        console.error('JWT 디코딩 오류:', error);
      }
    } else {
      isLoggedIn = false;
    }
  }

  // 2. 유튜브 API 로드 및 UI 관련 이벤트 리스너 설정
  console.log('🚀 앱 시작...');
  loadYouTubeAPI();
  window.addEventListener('playTrack', handlePlayTrack);
  setTimeout(() => {
    if (scrollingSongNameElement) {
      isSongNameScrollable =
        scrollingSongNameElement.scrollWidth > scrollingSongNameElement.clientWidth;
      scrollingSongNameElement.addEventListener('animationend', handleSongNameAnimationEnd);
    }
    if (scrollingArtistElement) {
      isArtistScrollable =
        scrollingArtistElement.scrollWidth > scrollingArtistElement.clientWidth;
      scrollingArtistElement.addEventListener('animationend', handleArtistAnimationEnd);
    }
  }, 0);

  // 3. 플레이리스트 목록 로드
  if (user.email) {
    try {
      const res = await fetch(`${backendUrl}/api/playlist?user_id=${user.email}`, {
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
      existingPlaylists = data; // 로드한 기존 플레이리스트 배열 저장
    } catch (error) {
      console.error('기존 플레이리스트 로드 실패:', error);
    }
  }

  // 4. 소켓 초기화 및 연결
  try {
    const { io } = await import('socket.io-client');
    socket = io(backendUrl, { transports: ['websocket'] });
    
    console.log('소켓 초기화됨, 연결 시도 중...');
    
    // 새로운 코드: 소켓 연결 상태 확인 및 디버깅
    socket.on('connect', () => {
      console.log(`⭐ 소켓 연결됨: ${socket.id}`);
      
      // 연결 직후 URL 파라미터 확인
      const liveUserParam = urlParams.get('liveUser');
      if (liveUserParam) {
        const roomId = liveUserParam.trim();
        console.log(`🔍 URL에서 liveUser 파라미터 감지: ${roomId}`);
        console.log(`🔗 클라이언트가 방 참여 요청: ${roomId}`);
        
        // 연결 직후 방 참여 요청 전송
        socket.emit('joinRoom', { roomId });
        console.log(`📤 joinRoom 이벤트 전송: ${roomId}`);
      }
    });
    
    socket.on('connect_error', (error) => {
      console.error(`❌ 소켓 연결 오류: ${error.message}`);
    });
    
    // 방 입장 관련 이벤트 핸들러
    socket.on('roomJoined', (data) => {
      console.log(`✅ 클라이언트가 방에 성공적으로 입장: ${data.roomId}`);
      currentRoomId = data.roomId;
    });
    
    // 방 생성 관련 이벤트 핸들러
    socket.on('roomCreated', (data) => {
      console.log(`✅ 새 룸 생성됨: ${data.roomId}`);
      currentRoomId = data.roomId;
      isLiveHost = true;
    });
    
    // 라이브 동기화 이벤트 핸들러
    socket.on('liveSync', (data) => {
      console.log('📡 liveSync 이벤트 수신:', data);
      
      if (data && data.track) {
        // 곡 정보 및 플레이어 업데이트
        if (data.track.streaming_id) {
          currentTrack.update((t) => ({
            ...t,
            ...data.track,
            albumImage: data.track.albumImage || '/default-album.png'
          }));
          
          // streaming_id 저장
          currentYouTubeVideoId = data.track.streaming_id;
          
          // 새 곡 또는 초기 동기화인 경우 YouTube 플레이어 업데이트
          if (youtubePlayer) {
            console.log(`🎵 기존 플레이어 업데이트, 비디오 ID: ${data.track.streaming_id}, 시간: ${data.currentTime || 0}`);
            youtubePlayer.loadVideoById({
              videoId: data.track.streaming_id,
              startSeconds: data.currentTime || 0
            });
            isPlaying = true;
            startProgressUpdate();
          } else {
            // 플레이어가 없는 경우 새로 생성
            console.log(`🆕 새 플레이어 생성, 비디오 ID: ${data.track.streaming_id}, 시간: ${data.currentTime || 0}`);
            youtubePlayer = new YT.Player('youtube-player', {
              height: '0',
              width: '0',
              videoId: data.track.streaming_id,
              playerVars: {
                autoplay: 1,
                controls: 0,
                showinfo: 0,
                modestbranding: 1,
                loop: 0,
                rel: 0,
                start: Math.floor(data.currentTime || 0)
              },
              events: {
                onReady: () => {
                  console.log('🎬 YouTube 플레이어 준비됨');
                  youtubePlayer.playVideo();
                  if (data.currentTime > 0) {
                    youtubePlayer.seekTo(data.currentTime, true);
                  }
                  startProgressUpdate();
                },
                onStateChange: (event) => {
                  if (event.data === YT.PlayerState.PLAYING) {
                    console.log('▶️ 곡 재생 중...');
                    isPlaying = true;
                    startProgressUpdate();
                  } else if (event.data === YT.PlayerState.PAUSED) {
                    console.log('⏸️ 곡 일시 정지됨');
                    isPlaying = false;
                  } else if (event.data === YT.PlayerState.ENDED) {
                    console.log('✅ 곡이 끝남!');
                    // 라이브 모드에서는 자동 재생하지 않음
                    if (!currentRoomId) {
                      playNextTrack();
                    }
                  }
                }
              }
            });
          }
          
          // 클라이언트가 초기 동기화를 받았으면 수신 확인 전송
          if (data.initialSync && currentRoomId) {
            socket.emit('syncReceived', { roomId: currentRoomId });
            console.log('✅ 동기화 데이터 수신 확인 전송');
          }
        } else if (data.track === null) {
          // 라이브 종료 시 플레이어 정지
          if (youtubePlayer) {
            youtubePlayer.pauseVideo();
          }
          isPlaying = false;
        }
      }
    });
    
    // 클라이언트 참여 이벤트 핸들러 (호스트만 실행)
    socket.on('clientJoined', (data) => {
      console.log('clientJoined 이벤트 수신:', data);
      
      if (isLiveHost && liveStatus === 'on') {
        const { clientId, roomId } = data;
        console.log(`🆕 새 클라이언트 참여: ${clientId}, 방: ${roomId}`);
        
        // 현재 스트리밍 ID 확인
        const streamingId = currentYouTubeVideoId || $currentTrack.streaming_id;
        
        if (!streamingId) {
          console.log('⚠️ 현재 스트리밍 ID가 없음, 동기화 불가');
          return;
        }
        
        // 현재 재생 시간 가져오기 (플레이어 있을 때만)
        let currentPlayTime = 0;
        if (youtubePlayer && youtubePlayer.getCurrentTime) {
          currentPlayTime = youtubePlayer.getCurrentTime();
        }
        
        // 클라이언트에게 현재 재생 정보 전송
        console.log(`📤 클라이언트 ${clientId}에게 초기 동기화 전송`);
        socket.emit('hostSync', {
          clientId,
          roomId,
          track: {
            ...$currentTrack,
            streaming_id: streamingId
          },
          currentTime: currentPlayTime
        });
        
        // 재시도 타이머 설정 (수신 확인이 없으면)
        let retryCount = 0;
        const timerId = setInterval(() => {
          if (retryCount >= MAX_SYNC_RETRY) {
            clearInterval(timerId);
            syncRetryTimers.delete(clientId);
            console.log(`⚠️ 클라이언트 ${clientId} 동기화 최대 재시도 횟수 초과`);
            return;
          }
          
          retryCount++;
          
          // 현재 재생 시간 다시 가져오기
          let currentTime = 0;
          if (youtubePlayer && youtubePlayer.getCurrentTime) {
            currentTime = youtubePlayer.getCurrentTime();
          }
          
          // 재시도
          console.log(`🔄 클라이언트 ${clientId} 동기화 재시도 #${retryCount}`);
          socket.emit('hostSync', {
            clientId,
            roomId,
            track: {
              ...$currentTrack,
              streaming_id: streamingId
            },
            currentTime
          });
        }, SYNC_RETRY_INTERVAL);
        
        syncRetryTimers.set(clientId, timerId);
      } else {
        console.log(`⚠️ 호스트 상태 아님 또는 라이브 중이 아님: isHost=${isLiveHost}, liveStatus=${liveStatus}`);
      }
    });
  } catch (error) {
    console.error('Socket.io 초기화 실패:', error);
  }
  // 추가: 전역 이벤트 리스너 등록
  window.addEventListener('joinLiveRoom', (event) => {
    if (socket && socket.connected && event.detail && event.detail.roomId) {
      handleLiveUserParam(event.detail.roomId);
    }
  });

  // 이벤트 리스너 정리 함수 반환
  return () => {
	window.removeEventListener('joinLiveRoom', handleLiveUserParam);

    window.removeEventListener('playTrack', handlePlayTrack);
    if (scrollingSongNameElement) {
      scrollingSongNameElement.removeEventListener('animationend', handleSongNameAnimationEnd);
    }
    if (scrollingArtistElement) {
      scrollingArtistElement.removeEventListener('animationend', handleArtistAnimationEnd);
    }
  };
});

// URL 변경 감지 및 라이브 모드 처리 - 통합된 반응형 구문
$: if (socket && socket.connected) {
  // 현재 URL에서 liveUser 파라미터 확인
  const liveUserParam = new URLSearchParams(window.location.search).get('liveUser');
  console.log('현재 URL 검사:', $page.url.pathname, $page.url.search, '라이브 파라미터:', liveUserParam);
  
  // 클라이언트 모드 (라이브 유저 파라미터가 있는 경우)
  if (liveUserParam && liveUserParam !== currentRoomId) {
    handleLiveUserParam(liveUserParam);
  }
  // 호스트 모드 (라이브 유저 파라미터가 없는 경우)
  else if (!liveUserParam && isLoggedIn) {
    // 트랙이 변경되었는지 확인
    const trackChanged = $currentTrack.name !== previousTrackName || 
                         $currentTrack.artist !== previousTrackArtist ||
                         $currentTrack.track_id !== previousTrackId;
    
    if (liveStatus === 'on' && isPlaying) {
      // 최초 라이브 시작 또는 트랙 변경 시에만 이벤트 발생
      if (previousLiveStatus !== 'on' || !currentRoomId || trackChanged) {
        console.log(`🔴 라이브 시작 또는 트랙 변경: ${$currentTrack.name}`);
        
        previousLiveStatus = 'on';
        previousTrackName = $currentTrack.name;
        previousTrackArtist = $currentTrack.artist;
        previousTrackId = $currentTrack.track_id;
        isLiveHost = true;
        
        // 한 번만 발송하도록 상태 확인
        const hostEmail = user.email.trim().toLowerCase();
        socket.emit('liveOn', { 
          user: { ...user, email: hostEmail }, 
          track: {
            ...$currentTrack,
            streaming_id: currentYouTubeVideoId
          }
        });
        console.log('호스트 liveOn 발신:', {
          user: { ...user, email: hostEmail },
          track: $currentTrack
        });
      }
    } else if (liveStatus === 'off' && previousLiveStatus === 'on') {
      // 라이브 종료
      console.log('⚫ 라이브 종료');
      
      previousLiveStatus = 'off';
      previousTrackName = '';
      previousTrackArtist = '';
      previousTrackId = '';
      isLiveHost = false;

      // 모든 재시도 타이머 정리
      for (const timerId of syncRetryTimers.values()) {
        clearInterval(timerId);
      }
      syncRetryTimers.clear();
      
      socket.emit('liveOff', { user });
      console.log('호스트 liveOff 발신:', { user });
      currentRoomId = ''; // roomId 초기화
    }
  }
}

	$: {
  console.log('소켓 상태 확인:', {
    소켓존재: !!socket,
    연결상태: socket?.connected,
    현재룸ID: currentRoomId
  });
}


//온마운트3 끝끝






//-----온마운트1 시작작 (기존 코드)
// onMount(async () => {
//   const { io } = await import('socket.io-client');
//   socket = io(backendUrl, { transports: ['websocket'] });
 
//   const urlParams = new URLSearchParams(location.search);
//   const liveUserParam = urlParams.get('liveUser');
//   console.log('liveUserParam:', liveUserParam);
 
//   if (liveUserParam) {
//     const roomId = liveUserParam.trim();
//     console.log(`🔗 클라이언트가 방 참여 요청: ${roomId}`);
    
//     // 소켓 연결 후 확실히 방 참여 요청 보내기
//     // 연결이 완료된 후에 joinRoom 이벤트를 보내기 위해 connect 이벤트 사용
//     if (socket.connected) {
//       socket.emit('joinRoom', { roomId });
//       console.log(`소켓 이미 연결됨. 방 참여 요청 전송: ${roomId}`);
//     } else {
//       socket.on('connect', () => {
//         socket.emit('joinRoom', { roomId });
//         console.log(`소켓 연결 완료. 방 참여 요청 전송: ${roomId}`);
//       });
//     }
    
//     // 서버에서 응답을 받을 때까지 확인
//     socket.on('roomJoined', (data) => {
//       console.log(`✅ 클라이언트가 방에 성공적으로 입장: ${data.roomId}`);
//       currentRoomId = data.roomId;
//     });
//   }

//   // 서버에서 생성된 roomId 수신
//   socket.on('roomCreated', (data) => {
//     console.log(`✅ 새 룸 생성됨: ${data.roomId}`);
// 	currentRoomId = data.roomId;
//     isLiveHost = true;
//   });

//   socket.on('liveSync', (data) => {
//     console.log('📡 liveSync 이벤트 수신:', data);

//     if (data && data.track) {
//       // 곡 정보 및 플레이어 업데이트
//       if (data.track.streaming_id) {
//         currentTrack.update((t) => ({
//           ...t,
//           ...data.track,
//           albumImage: data.track.albumImage || '/default-album.png'
//         }));
        
//         // 새 곡 또는 초기 동기화인 경우 YouTube 플레이어 업데이트
//         if (data.initialSync && data.currentTime > 0) {
//           // 특정 시간부터 재생 시작
//           if (youtubePlayer) {
//             youtubePlayer.loadVideoById({
//               videoId: data.track.streaming_id,
//               startSeconds: data.currentTime
//             });
//             isPlaying = true;
//             startProgressUpdate();
//           } else {
//             // 플레이어가 없는 경우 새로 생성 (초기 동기화에서만 발생할 수 있음)
//             youtubePlayer = new YT.Player('youtube-player', {
//               height: '0',
//               width: '0',
//               videoId: data.track.streaming_id,
//               playerVars: {
//                 autoplay: 1,
//                 controls: 0,
//                 showinfo: 0,
//                 modestbranding: 1,
//                 loop: 0,
//                 rel: 0,
//                 start: Math.floor(data.currentTime)
//               },
//               events: {
//                 onReady: () => {
//                   youtubePlayer.playVideo();
//                   if (data.currentTime > 0) {
//                     youtubePlayer.seekTo(data.currentTime, true);
//                   }
//                   startProgressUpdate();
//                 },
//                 onStateChange: (event) => {
//                   if (event.data === YT.PlayerState.PLAYING) {
//                     console.log('▶️ 곡 재생 중...');
//                     isPlaying = true;
//                     startProgressUpdate();
//                   } else if (event.data === YT.PlayerState.PAUSED) {
//                     console.log('⏸️ 곡 일시 정지됨');
//                     isPlaying = false;
//                   } else if (event.data === YT.PlayerState.ENDED) {
//                     console.log('✅ 곡이 끝남!');
//                     // 라이브 모드에서는 자동 재생하지 않음
//                     if (!currentRoomId) {
//                       playNextTrack();
//                     }
//                   }
//                 }
//               }
//             });
//           }
//         } else {
//           // 트랙만 변경 (처음부터 재생)
//           if (youtubePlayer) {
// 			youtubePlayer.loadVideoById({
//             videoId: data.track.streaming_id,
//             startSeconds: data.currentTime || 0
//           });
//           isPlaying = true;
//           startProgressUpdate();
//           }
//         }
        
//         // YouTube 비디오 ID 업데이트
//         currentYouTubeVideoId = data.track.streaming_id;
        
//         // 클라이언트가 초기 동기화를 받았으면 수신 확인 전송
//         if (data.initialSync && currentRoomId) {
//           socket.emit('syncReceived', { roomId: currentRoomId });
//           console.log('✅ 동기화 데이터 수신 확인 전송');
//         }
//       } else if (data.track === null) {
//         // 라이브 종료 시 플레이어 정지
//         if (youtubePlayer) {
//           youtubePlayer.pauseVideo();
//         }
//         isPlaying = false;
//       }
//     }
//   });
  
//   // 호스트만 해당: 새 클라이언트 참여 시 현재 재생 정보 전송
//   socket.on('clientJoined', (data) => {
//     console.log('clientJoined 이벤트 수신:', data);
    
//     if (isLiveHost && liveStatus === 'on' && isPlaying) {
//       const { clientId, roomId } = data;
//       console.log(`🆕 새 클라이언트 참여: ${clientId}, 방: ${roomId}`);
      
//       // 현재 재생 시간 가져오기
//       let currentPlayTime = 0;
//       if (youtubePlayer && youtubePlayer.getCurrentTime) {
//         currentPlayTime = youtubePlayer.getCurrentTime();
//       }
      
//       // 현재 스트리밍 ID 확인
//       const streamingId = currentYouTubeVideoId || $currentTrack.streaming_id;
      
//       if (!streamingId) {
//         console.log('⚠️ 현재 스트리밍 ID가 없음, 동기화 불가');
//         return;
//       }
      
//       // 클라이언트에게 현재 재생 정보 전송
//       const syncData = {
//         clientId,
//         roomId,
//         track: {
//           ...$currentTrack,
//           streaming_id: streamingId
//         },
//         currentTime: currentPlayTime
//       };
      
//       console.log('📤 동기화 데이터 전송:', syncData);
//       socket.emit('hostSync', syncData);
      
//       console.log(`📡 클라이언트 ${clientId}에게 초기 동기화 데이터 전송, 현재 시간: ${currentPlayTime}`);
      
//       // 재시도 타이머 설정 (수신 확인이 없으면)
//       let retryCount = 0;
//       const timerId = setInterval(() => {
//         if (retryCount >= MAX_SYNC_RETRY) {
//           clearInterval(timerId);
//           syncRetryTimers.delete(clientId);
//           console.log(`⚠️ 클라이언트 ${clientId} 동기화 최대 재시도 횟수 초과`);
//           return;
//         }
        
//         retryCount++;
        
//         // 현재 재생 시간 다시 가져오기
//         let currentTime = 0;
//         if (youtubePlayer && youtubePlayer.getCurrentTime) {
//           currentTime = youtubePlayer.getCurrentTime();
//         }
        
//         // 재시도
//         socket.emit('hostSync', {
//           clientId,
//           roomId,
//           track: {
//             ...$currentTrack,
//             streaming_id: streamingId
//           },
//           currentTime
//         });
        
//         console.log(`🔄 클라이언트 ${clientId} 동기화 재시도 #${retryCount}, 현재 시간: ${currentTime}`);
//       }, SYNC_RETRY_INTERVAL);
      
//       syncRetryTimers.set(clientId, timerId);
//     } else {
//       console.log(`⚠️ 호스트 상태 아님 또는 라이브 중이 아님: isHost=${isLiveHost}, liveStatus=${liveStatus}, isPlaying=${isPlaying}`);
//     }
//   });
//   // ===== 수정된 부분 끝 =====
// });
// //---온마운트1 끝 (기존코드 끝)


// 토글 상태에 따른 이벤트 발생 로직 수정(기존코드 시작)
// $: if (socket && isLoggedIn) {
//   const urlParams = new URLSearchParams(location.search);
//   const liveUserParam = urlParams.get('liveUser');
  
//   if (!liveUserParam) { // 호스트인 경우에만 emit
//     // 트랙이 변경되었는지 확인
//     const trackChanged = $currentTrack.name !== previousTrackName || 
//                         $currentTrack.artist !== previousTrackArtist ||
//                         $currentTrack.track_id !== previousTrackId;
    
//     if (liveStatus === 'on' && isPlaying) {
//       // 최초 라이브 시작 또는 트랙 변경 시에만 이벤트 발생
//       if (previousLiveStatus !== 'on' || !currentRoomId || trackChanged) {
//         previousLiveStatus = 'on';
//         previousTrackName = $currentTrack.name;
//         previousTrackArtist = $currentTrack.artist;
//         previousTrackId = $currentTrack.track_id;
// 		isLiveHost = true;
        
//         const hostEmail = user.email.trim().toLowerCase();
//         socket.emit('liveOn', { 
//           user: { ...user, email: hostEmail }, 
//           track: {
//             ...$currentTrack,
//             streaming_id: currentYouTubeVideoId
//           }
//         });
//         console.log('호스트 liveOn 발신:', {
//           user: { ...user, email: hostEmail },
//           track: $currentTrack,
//           trackId: $currentTrack.track_id
//         });
//       }
//     } else if (liveStatus === 'off' && previousLiveStatus === 'on') {
//       previousLiveStatus = 'off';
//       // 트랙 정보 초기화
//       previousTrackName = '';
//       previousTrackArtist = '';
//       previousTrackId = '';
// 	  isLiveHost = false;

// 	  // 모든 재시도 타이머 정리
//       for (const timerId of syncRetryTimers.values()) {
//         clearInterval(timerId);
//       }
//       syncRetryTimers.clear();
      
//       socket.emit('liveOff', { user });
//       console.log('호스트 liveOff 발신:', { user });
//       currentRoomId = ''; // roomId 초기화
//     }
//   }
// }
	// === 변경된 부분 끝 ===(기존 코드 끝)
 
	// ===================== [추가된 부분: 기존 플레이리스트 목록 로드 및 드롭다운 메뉴 관련 변수/함수] =====================
	// 새로운 변수 추가: 기존 플레이리스트 목록과 선택한 플레이리스트 ID
	let existingPlaylists = []; // DB에서 로드한 기존 플레이리스트 배열
	let selectedPlaylistId = ''; // 드롭다운에서 선택된 플레이리스트의 _id
 
	//---온마운트2 시작작 (기존 코드)
 // ✅ 앱 시작: Spotify 토큰 체크 제거, YouTube API 로드, 이벤트 리스너 등록
//  onMount(async () => {
// 	   const urlParams = new URLSearchParams(window.location.search);
// 	   const tokenFromUrl = urlParams.get('token');
// 	   if (tokenFromUrl) {
// 		  localStorage.setItem('jwt_token', tokenFromUrl);
// 		  isLoggedIn = true;
// 		  try {
// 			 const decoded = jwtDecode(tokenFromUrl);
// 			 user = {
// 				email: decoded.email,
// 				name: decoded.name,
// 				picture: decoded.picture
// 			 };
// 			 console.log('디코딩된 JWT:', decoded);
// 			 setContext('currentUser', user);
// 		  } catch (error) {
// 			 console.error('JWT 디코딩 오류:', error);
// 		  }
// 		  window.history.replaceState({}, document.title, '/');
// 	   } else {
// 		  const savedToken = localStorage.getItem('jwt_token');
// 		  if (savedToken) {
// 			 isLoggedIn = true;
// 			 try {
// 				const decoded = jwtDecode(savedToken);
// 				user = {
// 				   email: decoded.email,
// 				   name: decoded.name,
// 				   picture: decoded.picture
// 				};
// 				console.log('디코딩된 JWT:', decoded);
// 				setContext('currentUser', user);
// 			 } catch (error) {
// 				console.error('JWT 디코딩 오류:', error);
// 			 }
// 		  } else {
// 			 isLoggedIn = false;
// 		  }
// 	   }
// 	   console.log('🚀 앱 시작...');
// 	   loadYouTubeAPI();
// 	   window.addEventListener('playTrack', handlePlayTrack);
// 	   setTimeout(() => {
// 		  if (scrollingSongNameElement) {
// 			 isSongNameScrollable =
// 				scrollingSongNameElement.scrollWidth > scrollingSongNameElement.clientWidth;
// 			 scrollingSongNameElement.addEventListener('animationend', handleSongNameAnimationEnd);
// 		  }
// 		  if (scrollingArtistElement) {
// 			 isArtistScrollable =
// 				scrollingArtistElement.scrollWidth > scrollingArtistElement.clientWidth;
// 			 scrollingArtistElement.addEventListener('animationend', handleArtistAnimationEnd);
// 		  }
// 	   }, 0);
 
// 	   // [추가] 기존 플레이리스트 목록 로드: 현재 사용자의 이메일(user.email)로 DB 조회
// 	   if (user.email) {
// 		  try {
// 			 const res = await fetch(`${backendUrl}/api/playlist?user_id=${user.email}`, {
// 				headers: {
// 				   Accept: 'application/json',
// 				   'Content-Type': 'application/json',
// 				   'ngrok-skip-browser-warning': '69420'
// 				}
// 			 });
// 			 if (!res.ok) {
// 				throw new Error('플레이리스트 조회 실패');
// 			 }
// 			 const text = await res.text();
// 			 console.log('플레이리스트 로드 응답 텍스트:', text);
// 			 const data = JSON.parse(text);
// 			 existingPlaylists = data; // 로드한 기존 플레이리스트 배열 저장
// 		  } catch (error) {
// 			 console.error('기존 플레이리스트 로드 실패:', error);
// 		  }
// 	   }
 
// 	   return () => {
// 		  window.removeEventListener('playTrack', handlePlayTrack);
// 		  if (scrollingSongNameElement) {
// 			 scrollingSongNameElement.removeEventListener('animationend', handleSongNameAnimationEnd);
// 		  }
// 		  if (scrollingArtistElement) {
// 			 scrollingArtistElement.removeEventListener('animationend', handleArtistAnimationEnd);
// 		  }
// 	   };
// 	});
// 	//---온마운트2 끝 (기존 코드 끝)
 
	// [추가] 기존 플레이리스트에 곡 추가 API 호출 함수 (기존 리스트의 맨 위에 곡들을 추가)
	async function addTracksToExistingPlaylist(playlistId, tracksToAdd) {
	   try {
		  // tracksToAdd 배열을 새 플레이리스트 생성 시 사용했던 구조로 변환
		  const transformedTracks = tracksToAdd.map((track) => ({
			 track_id: track.id || track.track_id,
			 track_name: track.name,
			 artist_id: track.artist_id || 'unknown',
			 artist_name: track.artist || '알 수 없음',
			 album_id: track.album_id || (track.album ? track.album.id : 'unknown'),
			 album_image: track.album?.images
				? track.album.images[0].url
				: track.imageUrl || '/default-album.png'
		  }));
		  const response = await fetch(`${backendUrl}/api/playlist/${playlistId}`, {
			 method: 'PATCH',
			 headers: {
				'Content-Type': 'application/json'
			 },
			 body: JSON.stringify({ tracksToAdd: transformedTracks })
		  });
		  if (!response.ok) {
			 throw new Error('기존 플레이리스트에 곡 추가 실패');
		  }
		  const data = await response.json();
		  console.log('기존 플레이리스트 업데이트 성공:', data);
		  // 업데이트 후 playlistManager 업데이트 (필요하면 다시 불러오기)
		  playlistManager.update((groups) =>
			 groups.map((group) => (group._id === playlistId ? data : group))
		  );
	   } catch (error) {
		  console.error(error);
	   }
	}
 
	// ✅ 플레이리스트 토글 여부 (on/off) 상태 추가 02.13 플레이리스트트
	let showPlaylist = false;
	function togglePlaylist() {
	   showPlaylist = !showPlaylist;
	}
 
	// ★ 삭제 기능: 전달받은 인덱스의 트랙을 플레이리스트에서 제거
	function removeFromPlaylist(index) {
	   playlist.update((tracks) => tracks.filter((_, i) => i !== index));
	}
 
	let showCreatePlaylist = false;
	let newPlaylistName = '';
 
	function toggleCreatePlaylist() {
	   showCreatePlaylist = !showCreatePlaylist;
	}
 
	function createPlaylist() {
	   if (newPlaylistName.trim() !== '') {
		  playlist.update((currentList) => [...currentList, { id: Date.now(), name: newPlaylistName }]);
		  newPlaylistName = '';
		  showCreatePlaylist = false;
	   }
	}
 
	// ===============================
	// 신규: 플레이리스트 그룹 생성을 위한 변수와 함수 2025.02.14 플레이리스트트
	let showCreatePlaylistGroup = false;
	let newPlaylistGroupName = '';
 
	function toggleCreatePlaylistGroup() {
	   showCreatePlaylistGroup = !showCreatePlaylistGroup;
	   selectedPlaylistId = '';
	}
 
	// [추가됨] 플레이리스트 그룹 생성 결과 메시지를 저장할 상태 변수
	let playlistGroupMessage = '';
 
	// 변경된 createPlaylistGroup 함수
	function createPlaylistGroup() {
	   // 만약 기존 플레이리스트 선택(dropdown에서 선택됨)이 있다면, 기존 리스트에 곡 추가
	   if (selectedPlaylistId) {
		  // 현재 로컬 플레이리스트($playlist) 곡들을 기존 리스트의 맨 위에 추가하도록 API 호출
		  // 여기서는 tracksToAdd를 $playlist의 전체 배열로 가정합니다.
		  addTracksToExistingPlaylist(selectedPlaylistId, $playlist);
		  newPlaylistGroupName = '';
		  showCreatePlaylistGroup = false;
		  // [추가됨] 에러 메시지 초기화
		  playlistGroupError = '';
		  playlistGroupSuccess = '플레이리스트에 곡이 추가되었습니다.';
	   } else {
		  // 기존처럼 새 플레이리스트 그룹 생성
		  if (newPlaylistGroupName.trim() !== '') {
			 const newPlaylistGroup = {
				email: user.email || '로그인된사용자아이디', // email 필드 사용
				name: newPlaylistGroupName,
				tracks: $playlist.map((track) => ({
				   track_id: track.id,
				   track_name: track.name,
				   artist_id: track.artist_id || 'unknown',
				   artist_name: track.artist || '알 수 없음',
				   album_id: track.album_id || (track.album ? track.album.id : 'unknown'),
				   album_image: track.album?.images
					  ? track.album.images[0].url
					  : track.imageUrl || '/default-album.png'
				}))
			 };
 
			 fetch(`${backendUrl}/api/playlist`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newPlaylistGroup)
			 })
				.then((response) => {
				   if (!response.ok) {
					  // [변경됨] 에러 응답을 json으로 파싱 후 에러 메시지 던지기
					  return response.json().then((errData) => {
						 throw new Error(errData.error || '플레이리스트 그룹 생성 실패');
					  });
				   }
				   return response.json();
				})
				.then((savedGroup) => {
				   playlistManager.update((groups) => [...groups, savedGroup]);
				   newPlaylistGroupName = '';
				   showCreatePlaylistGroup = false;
				   playlistGroupMessage = '플레이리스트 그룹이 성공적으로 생성되었습니다.';
				})
				.catch((error) => {
				   console.error('Error creating playlist group:', error);
				   // [변경됨] 에러 메시지를 상태 변수에 저장
				   playlistGroupMessage = error.message;
				});
		  }
	   }
	}
	// ADDED: Live 토글 상태 변수 (기본 off) 및 inline 토글 함수
	let liveStatus = 'off';
	function toggleLive() {
	   liveStatus = liveStatus === 'on' ? 'off' : 'on';
	}
 
 </script>
 
 <!-- 로그인/로그아웃 버튼과 사용자 정보는 오른쪽 상단에 고정 -->
 
 <div class="layout">
	<div class="sidebar">
	   <h2><a href="/">It-Da</a></h2>
	   <nav>
		  <ul>
			 <li><a href="/about">About</a></li>
			 <li><a href="/hi">Hi</a></li>
			 <li><a href="/search">Search</a></li>
			 <li><a href="/podcast">Podcast</a></li>
		  </ul>
	   </nav>
	   <h3>Library</h3>
	   <ul>
		  <li><a href="/favorites">Favorites</a></li>
		  <li><a href="/playlistManager">Playlist</a></li>
	   </ul>
 
	   <div class="logo-container">
		  <img src="/logo2.png" alt="Logo" class="logo-image" />
	   </div>
	</div>
 
	<div class="main-content">
	   <div class="inner-main">
		  <div class="left-area">
			 <h1 class="typing">It Da!</h1>
			 {#if isLoggedIn}
			   <div class="live-toggle-container">
				<label class="toggle-switch">
				  <input type="checkbox" on:change={toggleLive} checked={liveStatus === 'on'} />
				  <span class="slider"></span>
				</label>
				<span class="live-text">{liveStatus === 'on' ? 'Live On' : 'Live Off'}</span>
			   </div>
			 {/if}
		  </div>
		  <div class="login-header" style="top: 0; right: 0; z-index: 1010; padding: 10px;">
			{#if isLoggedIn}
			 <div class="user-info">
			   <img src={user.picture} alt="{user.name}'s profile picture" style="width:40px; height:40px; border-radius:50%;" />
			   <span>반갑습니다! {user.name} 님</span>
			   <button on:click={logout} style="margin-left: 10px;">로그아웃</button>
			   <button on:click={togglePlaylist}>
				{showPlaylist ? '플레이리스트 숨기기' : '플레이리스트 보기'}
			   </button>
			 </div>
			{:else}
			 <button on:click={() => (window.location.href = `${backendUrl}/api/google/google-login?prompt=select_account`)}>
			   구글 로그인
			 </button>
			{/if}
		  </div>
		 </div>
	   <slot />
	</div>
 
	{#if showPlaylist}
	   <!-- 02.13 플레이리스트트 -->
	   <div class="playlist" transition:fly={{ x: 250, duration: 300 }}>
		  <h2>Playlist</h2>
 
		  {#if $playlist.length > 0}
			 <ul class="playlist-add-group">
				{#each $playlist as track, index}
				   <li class="playlist-track">
					  <img
						 src={track.album?.images[0]?.url || track.imageUrl || '/default-album.png'}
						 alt="Album Cover"
						 width="30"
						 height="30"
					  />
					  <span class="track-info">
						 {track.name} - {track.artists?.map((artist) => artist.name).join(', ') ||
							track.artist ||
							'알 수 없음'}
					  </span>
					  <!-- 삭제 버튼을 오른쪽에 고정 -->
					  <button class="delete-btn" on:click={() => removeFromPlaylist(index)}>-</button>
				   </li>
				{/each}
			 </ul>
		  {:else}
			 <p class="empty">플레이리스트가 비어 있습니다.</p>
		  {/if}
 
		  <!-- 기존 플레이리스트 그룹 생성 UI 부분 -->
		  <div class="playlist-group-creation">
			 <!-- [변경된 부분] 기존 플레이리스트 선택 드롭다운과 입력창을 별도 조건으로 렌더링 -->
			 {#if !selectedPlaylistId}
				<input
				   type="text"
				   bind:value={newPlaylistGroupName}
				   placeholder="새 플레이리스트 그룹 이름 입력 (또는 기존 선택)"
				/>
			 {/if}
			 <!-- 드롭다운 메뉴는 항상 표시 -->
			 {#if existingPlaylists.length > 0}
				<select bind:value={selectedPlaylistId}>
				   <option value="">-- 기존 플레이리스트 선택 (없으면 새로 생성) --</option>
				   {#each existingPlaylists as list}
					  <option value={list._id}>{list.name}</option>
				   {/each}
				</select>
			 {/if}
			 <!-- 버튼 텍스트 변경: 선택 여부에 따라 -->
			 <button on:click={createPlaylistGroup}>
				{#if selectedPlaylistId}
				   기존 리스트에 곡 추가
				{:else}
				   플레이리스트 생성
				{/if}
			 </button>
			 <button on:click={toggleCreatePlaylistGroup}>취소</button>
			 <!-- [추가됨] 에러 메시지 표시 영역 -->
			 {#if playlistGroupMessage}
				<div class="playlist-group-message">
				   {playlistGroupMessage}
				</div>
			 {/if}
		  </div>
	   </div>
	{/if}
 
	<!-- ✅ 전역 플레이어 -->
	<div class="player">
	   <a href="/song" tabindex="0" role="button" on:click|preventDefault={navigateToSongPage}>
		  <img src={$currentTrack?.albumImage || ''} alt="Album Cover" class="player-album-cover" />
	   </a>
	   <div class="player-track-info">
		  <div
			 class="scrolling-text song-name"
			 bind:this={scrollingSongNameElement}
			 class:scrollable={isSongNameScrollable}
		  >
			 <strong>{$currentTrack.name}</strong>
		  </div>
		  <div
			 class="scrolling-text artist-name"
			 bind:this={scrollingArtistElement}
			 class:scrollable={isArtistScrollable}
		  >
			 <p>{$currentTrack.artist}</p>
		  </div>
	   </div>
 
	   <!-- ✅ 현재 재생 시간 / 총 길이 표시 -->
	   <div class="wrap-time">
		  <div class="time-info">
			 <button on:click={playPreviousTrack}>⏮️</button>
			 <button on:click={togglePause}>
				{isPlaying ? '⏸️' : '▶️'}
			 </button>
			 <button on:click={playNextTrack}>⏭️</button>
 
			 <span>{formatTime(currentTime)}</span>
			 <input
				type="range"
				min="0"
				max="100"
				step="0.1"
				bind:value={progress}
				on:input={seekTrack}
				class="progress-bar"
			 />
			 <span>{formatTime(duration)}</span>
		  </div>
	   </div>
	   <!-- 볼륨 조절 컨트롤 -->
	   <div class="volume-control">
		  <span>Vol</span>
		  <input
			 type="range"
			 min="0"
			 max="100"
			 step="1"
			 bind:value={volume}
			 on:input={updateVolume}
			 class="volume-slider"
		  />
	   </div>
	</div>
 
	<div id="youtube-player"></div>
 </div>
 
 <style>
	:global(body) {
	   /* this will apply to <body> */
	   margin: 0;
	   padding: 0;
	   background-color: black;
	}
 
	*::-webkit-scrollbar {
	   display: none;
	}
 
	* {
	   -ms-overflow-style: none;
	   scrollbar-width: none;
	}
	.layout {
	   display: flex;
	   height: 100vh;
	   overflow: hidden;
	   z-index: 1000;
	}
 
	.sidebar {
	   width: 250px;
	   background-color: white;
	   color: black;
	   text-decoration: none;
	   display: flex;
	   flex-direction: column;
	   gap: 20px;
	}
 
	
 
	.sidebar h2,
	h3,
	nav {
	   padding-left: 20px;
	}
 
	/* .logo-image {
				 position: absolute;
				 bottom: 50px; 
				 width: 250px;
	} */
 
	.logo-container {
	   width: 100%; /* ✅ 사이드바 크기에 맞게 설정 */
	   display: flex;
	   justify-content: center;
	   align-items: center;
	   margin-top: auto; /* ✅ 사이드바의 하단에 정렬 */
	   gap: 20px;
	   padding-bottom: 70px;
	}
 
	.logo-image {
	   width: 100%; /* ✅ 사이드바 크기에 맞게 조절 */
	   max-width: 200px; /* ✅ 최대 크기 제한 */
	   object-fit: contain; /* ✅ 이미지 비율 유지 */
	   transition: width 0.3s ease-in-out; /* ✅ 크기 변화 애니메이션 */
	}
 
	.sidebar:visited {
	   color: black;
	}
 
	.sidebar h2 a {
	   color: black;
	   text-decoration: none;
	   font-size: 40px;
	   transition: font-size 0.3s ease;
	}
 
	.sidebar h2 a:hover {
	   color: fuchsia;
	   font-size: 45px;
	}
 
	li {
	   list-style: none;
	}
	li a {
	   font-size: 25px;
	   color: black;
	   text-decoration: none;
	   transition: font-size 0.3s ease;
	}
 
	li a:hover {
	   color: deeppink;
	   font-size: 27px;
	}
 
	.main-content {
	max-width: 100%;
	   flex-grow: 1;
	   background-color: black;
	   color: white;
	   display: flex;
	   flex-direction: column;
	   overflow: auto;
	   padding-bottom: 70px;
	   
	   z-index: 1;
	}
 
	.player {
	   display: flex;
	   align-items: center;
	   justify-content: space-between;
	   position: fixed;
	   bottom: 0;
	   width: 100%;
	   height: 70px;
	   background-color: #222;
	   color: white;
	   display: flex;
	   padding: 0 40px 0 20px;
	   box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.2);
	   z-index: 100;
	}
 
	.player img {
	   width: 50px;
	   height: 50px;
	   border-radius: 5px;
	   margin-right: 10px;
	   box-shadow: 0 0 5px rgba(255, 255, 255, 0.6); /* ✅ 부드러운 흰색 박스 쉐도우 */
	}
 
	.player-track-info {
	   width: 150px; /* 고정 너비 */
	   overflow: hidden; /* 넘치는 텍스트 숨김 */
	   white-space: nowrap; /* 한 줄로 표시 */
	}
 
	.scrolling-text {
	   white-space: nowrap;
	}
	/* 'scrollable' 클래스가 있을 때만 marquee 애니메이션 적용 */
	/* 'scrollable' 클래스가 있을 때만 marquee 애니메이션 적용, 1회 실행 */
	.scrolling-text.scrollable {
	   /* 전체 애니메이션 시간은 CSS 변수로 계산된 값, 1회 실행 */
	   animation: marquee var(--marquee-duration, 10s) linear 1;
	}
 
	@keyframes marquee {
	   0% {
		  transform: translateX(0);
	   }
	   80% {
		  transform: translateX(calc(-1 * var(--overflow-distance)));
	   }
	   100% {
		  transform: translateX(calc(-1 * var(--overflow-distance)));
	   }
	}
	.player strong {
	   font-size: 14px;
	}
 
	.player p {
	   font-size: 12px;
	   color: #bbb;
	   margin: 0;
	}
 
	.player button {
	   background: none;
	   border: none;
	   color: white;
	   font-size: 40px;
	   cursor: pointer;
	}
 
	.player button:hover {
	   color: #1db954;
	}
 
	.wrap-time {
	   display: flex;
	   align-items: center;
	   gap: 8px;
	   font-size: 14px;
	   color: #bbb;
	   width: 90%;
	}
 
	.time-info {
	   display: flex;
	   align-items: center;
	   gap: 8px;
	   font-size: 14px;
	   color: #bbb;
	   width: 80%;
	}
 
	/* ✅ 프로그레스 바 스타일 */
	.progress-bar {
	   width: 80%;
	   margin: 0 10px;
	   appearance: none;
	   background: #555;
	   height: 5px;
	   border-radius: 5px;
	   cursor: pointer;
	}
 
	.progress-bar::-webkit-slider-thumb {
	   appearance: none;
	   background: #1db954;
	   width: 10px;
	   height: 10px;
	   border-radius: 50%;
	   cursor: pointer;
	}
 
	.user-info span {
	   color: white;
	}
 
	.login-header button {
	   background: #1db954;
	   color: white;
	   border: none;
	   padding: 8px 12px;
	   font-size: 14px;
	   border-radius: 5px;
	   cursor: pointer;
	   transition: background 0.3s;
	   margin-left: 10px;
	}
 
	.login-header button:hover {
	   background-color: hotpink;
	}
 
	/* 볼륨 컨트롤 영역 */
	.volume-control {
	   display: flex;
	   align-items: center;
	   gap: 5px;
	   margin-left: 20px; /* 필요에 따라 위치 조정 */
	   margin-right: 50px;
	}
 
	/* 볼륨 슬라이더 스타일 */
	.volume-slider {
	   width: 100px; /* 슬라이더 너비 조정 */
	   appearance: none;
	   background: #555;
	   height: 5px;
	   border-radius: 5px;
	   cursor: pointer;
	}
 
	/* 웹킷 기반 브라우저용 슬라이더 thumb 스타일 */
	.volume-slider::-webkit-slider-thumb {
	   appearance: none;
	   background: #1db954;
	   width: 10px;
	   height: 10px;
	   border-radius: 50%;
	   cursor: pointer;
	}
 
	/* 파이어폭스 등 다른 브라우저 지원 */
	.volume-slider::-moz-range-thumb {
	   background: #1db954;
	   width: 10px;
	   height: 10px;
	   border-radius: 50%;
	   cursor: pointer;
	}
 
	/* ===== 플레이리스트 영역 스타일 ===== 02.13 플레이리스트트 */
	.playlist {
	   width: 250px;
	   max-width: 250px;
	   background: rgb(168, 209, 18);
	   color: black;
	   padding-left: 20px;
	   padding-right: 20px;
	   overflow-y: auto;
	   margin-bottom: 50px;
	   z-index: 3;
	}
	.playlist h2 {
	   position: fixed;
	   background: rgb(168, 209, 18);
	   width: 250px;
	   max-width: 250;
	   overflow: hidden;
	   margin-top: 0px;
	}
 
	.empty {
	   margin-top: 35px;
	}
 
	.playlist-add-group {
	   margin-top: 40px;
	}
 
	.playlist-track {
	   display: flex;
	   align-items: center;
	   padding: 5px 0;
	}
 
	/* 트랙 정보에 약간의 여백 추가 */
	.track-info {
	   margin-left: 10px;
	}
 
	/* 삭제 버튼을 오른쪽에 고정 */
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
 
	/* 신규: 플레이리스트 그룹 생성 UI 스타일 */
	.playlist-group-creation {
	   margin-top: 1rem;
	   text-align: center;
	}
 
	.playlist-group-creation button:hover {
	   background-color: #6d6d6d;
	   color: white;
	}
 
	/* 버튼과 인풋이 실제 렌더링 될 때 적용되도록 :global 사용 */
	.playlist-group-creation :global(button),
	.playlist-group-creation :global(input) {
	   padding: 8px 12px;
	   font-size: 14px;
	   border: none;
	   border-radius: 5px;
	   outline: none;
	   margin: 0.5rem;
	}
 
	.main-content h1 {
	   position: sticky;
	   top: 0;
	   z-index: 2; /* slot 콘텐츠보다 위에 표시 */
	   background-color: black; /* 배경색을 지정하여 아래 내용과 구분 */
	   margin: 0;
	   padding: 10px;
	}
 
	.inner-main {
	   position: sticky;
	   display: flex;
	   justify-content: space-between; /* 양쪽 정렬 */
	   align-items: center; /* 세로 중앙 정렬 */
	   padding: 10px;
	   z-index: 30;
	   background-color: black;
	   top:0;
	}
	
	.playlist-group-message {
	   margin-top: 0.5rem;
	   font-size: 14px;
	   /* 메시지 내용에 따라 색상을 동적으로 변경할 수 있습니다. 예: */
	   color: var(--playlist-group-message-color, green);
	}
	   /* ADDED: Live 토글 스위치 스타일 */
	   .live-toggle-container {
	   display: inline-flex;
	   align-items: center;
	}
	.toggle-switch {
	   position: relative;
	   display: inline-block;
	   width: 50px;
	   height: 24px;
	}
	.toggle-switch input {
	   opacity: 0;
	   width: 0;
	   height: 0;
	}
	.slider {
	   position: absolute;
	   cursor: pointer;
	   top: 0;
	   left: 0;
	   right: 0;
	   bottom: 0;
	   background-color: #ccc;
	   transition: 0.4s;
	   border-radius: 24px;
	}
	.slider:before {
	   position: absolute;
	   content: "";
	   height: 20px;
	   width: 20px;
	   left: 2px;
	   bottom: 2px;
	   background-color: white;
	   transition: 0.4s;
	   border-radius: 50%;
	}
	input:checked + .slider {
	   background-color: #1db954;
	}
	input:checked + .slider:before {
	   transform: translateX(26px);
	}
	.live-text {
	   margin-left: 10px;
	   font-size: 16px;
	   color: #1db954;
	}
	/* .left-area에 flex를 적용해서 자식 요소(제목, 토글버튼)를 가로로 배치 */
 .left-area {
   display: flex;
   align-items: center; /* 세로 정렬: 가운데 정렬 */
   gap: 10px;          /* "It Da!"와 토글 버튼 사이의 간격 */
 }
 </style>
 