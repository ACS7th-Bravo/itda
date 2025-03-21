<script>
  import { onMount, onDestroy } from 'svelte';
  import ColorThief from 'colorthief';
  import WavyBackground from '$lib/components/ui/WavyBackground/WavyBackground.svelte';

  // 원본 이미지 10장
  let allImages = [
    '/aespa.jpg', '/eminem.jpg', '/justin.jpg', '/weekend.jpg', '/gdragon.png',
    '/travis.jpg', '/aomg.jpg', '/taeyeon.jpg', '/nct.jpg', '/team.jpg'
  ];

  let images = []; // 10장 중 랜덤으로 선택된 5장

  // 🎯 랜덤으로 이미지 5장 선택하는 함수
  function getRandomImages(array, count) {
      let shuffled = [...array].sort(() => 0.5 - Math.random()); // 배열 랜덤 섞기
      return shuffled.slice(0, count); // 상위 5개 선택
  }

  // 🟢 onMount에서 한 번만 5장 선택
  onMount(() => {
      images = getRandomImages(allImages, 5);
  });

  let currentIndex = 0;
  let interval;

  // 🟢 10초마다 인덱스를 변경 (자동 슬라이딩)
  onMount(() => {
      interval = setInterval(() => {
          currentIndex = (currentIndex + 1) % images.length;
      }, 10000);
  });

  onDestroy(() => {
      clearInterval(interval);
  });

  // 🟢 기존 코드 유지: transform 계산
  function getWrapOffset(i, current, length) {
      let offset = i - current;
      if (offset < 0) offset += length;
      return offset % length;
  }

  function calcTransform(i, current) {
      const offset = getWrapOffset(i, current, images.length);
      if (offset === 0) return `rotateY(0deg) translate(-50%, -50%) scale(1)`;
      if (offset === 1) return `rotateY(-15deg) translateX(300px) translate(-50%, -50%) scale(0.5)`;
      if (offset === 2) return `rotateY(-25deg) translateX(450px) translate(-50%, -50%) scale(0.3)`;
      if (offset === images.length - 1) return `rotateY(15deg) translateX(-300px) translate(-50%, -50%) scale(0.5)`;
      if (offset === images.length - 2) return `rotateY(25deg) translateX(-450px) translate(-50%, -50%) scale(0.3)`;
      return `rotateY(25deg) translateX(-450px) translate(-50%, -50%) scale(0.3)`;
  }

  function calcOpacity(i, current) {
      const offset = getWrapOffset(i, current, images.length);
      return (offset === 0 || offset === 1 || offset === 2 || offset === images.length - 2 || offset === images.length - 1) ? 1 : 0;
  }

  function calcBrightness(i, current) {
      const offset = getWrapOffset(i, current, images.length);
      if (offset === 0) return 1;
      if (offset === 1 || offset === images.length - 1) return 0.8;
      if (offset === 2 || offset === images.length - 2) return 0.6;
      return 0;
  }

  function calcZIndex(i, current) {
      const offset = getWrapOffset(i, current, images.length);
      if (offset === 0) return 10;
      if (offset === 1 || offset === images.length - 1) return 9;
      if (offset === 2 || offset === images.length - 2) return 8;
      return 0;
  }

  // 🟢 기존 코드 유지: reactive 변수들 선언 유지
  let transforms = [];
  let zIndices = [];
  let opacities = [];
  let brightnesses = [];

  // 🟢 기존 코드 유지: reactive 선언
  $: transforms = images.map((_, i) => calcTransform(i, currentIndex));
  $: zIndices = images.map((_, i) => calcZIndex(i, currentIndex));
  $: opacities = images.map((_, i) => calcOpacity(i, currentIndex));
  $: brightnesses = images.map((_, i) => calcBrightness(i, currentIndex));

  function setCardColor(event) {
      const img = event.target;
      if (!img.complete) return;
      const card = img.closest('.card');
      const colorThief = new ColorThief();
      try {
          let color = colorThief.getColor(img);
          card.style.setProperty('--color-card', `rgb(${color.join(',')})`);
      } catch (err) {
          console.error('컬러 추출 실패:', err);
      }
  }
</script>
  
  <style>
   
    .carousel-container {
      top: -900px;
      position: relative;
      width: 900px;
      height: 600px;
      margin: 20px auto;
      perspective: 2100px;
      z-index: 10; /* WavyBackground의 z-index(10)보다 높은 값 */
    }
    
    .card {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 900px;
      height: 600px;
      transform-style: preserve-3d;
      /* transform, opacity, 그리고 filter 모두 전환 */
      transition: transform 1s ease, opacity 1s ease, filter 1s ease;
      border-radius: 5px;
      overflow: hidden;
      backface-visibility: hidden;
      transform-origin: 50% 50%;
      /* --- Glass Effect 및 컬러 적용 추가 시작 --- */
      padding: 20px; /* 내부 여백 추가로 이미지와 테두리 간격 확보 */

    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    outline: 1px solid var(--color-card, rgba(255, 255, 255, 0.2));
    /* --- Glass Effect 및 컬러 적용 추가 끝 --- */
    }
    
    .card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    h1, p {
      text-align: center;
    }

  
.WavyBackground{
  z-index: 1;
}

.all{
  height: 949px;
}
    
  </style>
    
  <h1>It-Da에서 좋아하는 음악을 검색해보세요</h1>
    
<!-- 새로 추가되는 부분: WavyBackground로 슬라이더 배경 적용 -->

<!-- 부모 컨테이너: relative position, z-index는 auto -->
 <div class="all">
<div class="WavyBackground">
  <!-- 배경: WavyBackground를 절대 위치 + 음수 z-index로 배치 -->
  <WavyBackground 
    backgroundFill="#000"
    containerClassName="h-full w-full z-[-10]"
    colors={['#38bdf8', '#818cf8', '#c084fc', '#e879f9', '#22d3ee']}
    waveWidth={50}
    blur={10}
    speed="fast"
    waveOpacity={0.5} />
  </div>

  <!-- 캐러셀: 배경 위에 위치 -->
  <div class="carousel-container">
    {#each images as image, i}
      <div class="card"
           style:z-index={zIndices[i]}
           style:transform={transforms[i]}
           style:opacity={opacities[i]}
           style:filter={`brightness(${brightnesses[i]})`}>
        <img src={image} alt="카드 이미지" on:load={setCardColor} crossOrigin="anonymous" />
      </div>
    {/each}
  </div>
</div>

    
  <p>
    It-Da<br>
    Search and translate your favorite song<br>
    You can share your mood
  </p>


