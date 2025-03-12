<script>
    import { onMount, onDestroy } from 'svelte';
    import ColorThief from 'colorthief';  /* --- 추가된 부분 시작: ColorThief import --- */
    import WavyBackground from '$lib/components/ui/WavyBackground/WavyBackground.svelte';

  
    // 예시 이미지 10장
    let images = [
      '/aespa.jpg',
      '/eminem.jpg',
      '/justin.jpg',
      '/weekend.jpg',
      '/gdragon.png',
      '/travis.jpg',
      '/aomg.jpg',
      '/taeyeon.jpg',
      '/nct.jpg',
      '/team.jpg',
      '/ariana.jpg'
    ];

    const images2 = [
		'https://images.unsplash.com/photo-1554080353-a576cf803bda?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3387&q=80',
		'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3070&q=80',
		'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3540&q=80',
		'https://images.unsplash.com/photo-1554080353-a576cf803bda?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3387&q=80',
		'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3070&q=80',
		'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3540&q=80',
		'https://images.unsplash.com/photo-1682686581854-5e71f58e7e3f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDF8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3540&q=80',
		'https://images.unsplash.com/photo-1510784722466-f2aa9c52fff6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3540&q=80',
		'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3540&q=80',
		'https://images.unsplash.com/photo-1439853949127-fa647821eba0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2640&q=80',
		'https://images.unsplash.com/photo-1554080353-a576cf803bda?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3387&q=80',
		'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3070&q=80',
		'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3540&q=80',
		'https://images.unsplash.com/photo-1554080353-a576cf803bda?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3387&q=80',
		'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3070&q=80',
		'https://images.unsplash.com/photo-1554080353-a576cf803bda?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3387&q=80',
		'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3070&q=80',
		'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3540&q=80',
		'https://images.unsplash.com/photo-1554080353-a576cf803bda?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3387&q=80',
		'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3070&q=80',
		'https://images.unsplash.com/photo-1554080353-a576cf803bda?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3387&q=80',
		'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3070&q=80',
		'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3540&q=80',
		'https://images.unsplash.com/photo-1554080353-a576cf803bda?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3387&q=80',
		'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3070&q=80'
	];
  
    // 현재 중앙(포커싱) 카드 인덱스
    let currentIndex = 0;
    let interval;
  
    // reactive 변수들을 미리 선언
    let transforms = [];
    let zIndices = [];
    let opacities = [];
    let brightnesses = [];
  
    // 3초마다 인덱스를 1씩 증가
    onMount(() => {
      interval = setInterval(() => {
        currentIndex = (currentIndex + 1) % images.length;
        console.log('currentIndex:', currentIndex);
      }, 10000);
    });
  
    onDestroy(() => {
      clearInterval(interval);
    });
  
    /**
     * i번째 카드가 currentIndex와 얼마나 떨어져 있는지를
     * "원형"으로 계산하는 함수.
     * 예: (i=0, currentIndex=8, length=10) => offset = 0 - 8 = -8,
     *    -8 < 0 이므로 offset += 10 => offset = 2.
     */
    function getWrapOffset(i, current, length) {
      let offset = i - current;
      if (offset < 0) {
        offset += length;
      }
      return offset % length;
    }
  
    /**
     * i번째 카드에 적용할 transform 계산
     * Visible한 offset은:
     *  - 0: 중앙 → scale(1)
     *  - 1: 오른쪽 첫번째 → rotateY(-15deg), translateX(300px), scale(0.5)
     *  - 2: 오른쪽 두번째 → rotateY(-25deg), translateX(450px), scale(0.3)
     *  - (length - 1): 왼쪽 첫번째 → rotateY(15deg), translateX(-300px), scale(0.5)
     *  - (length - 2): 왼쪽 두번째 → rotateY(25deg), translateX(-450px), scale(0.3)
     * 그 외(visible 범위 밖)는 경계 transform을 그대로 사용.
     */
    function calcTransform(i, current) {
      const offset = getWrapOffset(i, current, images.length);
      if (offset === 0) {
        return `rotateY(0deg)
                translate(-50%, -50%)
                scale(1)`;
      } else if (offset === 1) {
        return `rotateY(-15deg)
                translateX(300px)
                translate(-50%, -50%)
                scale(0.5)`;
      } else if (offset === 2) {
        return `rotateY(-25deg)
                translateX(450px)
                translate(-50%, -50%)
                scale(0.3)`;
      } else if (offset === images.length - 1) {
        return `rotateY(15deg)
                translateX(-300px)
                translate(-50%, -50%)
                scale(0.5)`;
      } else if (offset === images.length - 2) {
        return `rotateY(25deg)
                translateX(-450px)
                translate(-50%, -50%)
                scale(0.3)`;
      } else {
        // visible 범위 밖인 경우, 경계값(transform)을 그대로 유지
        if (offset > 2) {
          return `rotateY(-25deg)
                  translateX(450px)
                  translate(-50%, -50%)
                  scale(0.3)`;
        } else {
          return `rotateY(25deg)
                  translateX(-450px)
                  translate(-50%, -50%)
                  scale(0.3)`;
        }
      }
    }
  
    /**
     * i번째 카드의 opacity 계산
     * Visible한 경우: offset 0, 1, 2, (length - 2), (length - 1) → opacity 1, 그 외 → 0.
     */
    function calcOpacity(i, current) {
      const offset = getWrapOffset(i, current, images.length);
      return (offset === 0 || offset === 1 || offset === 2 || offset === images.length - 2 || offset === images.length - 1) ? 1 : 0;
    }
  
    /**
     * i번째 카드의 brightness 계산 (filter: brightness)
     * 중앙 카드(offset 0): brightness 1 (정상 밝기)
     * offset 1 또는 (length - 1): brightness 0.8 (조금 어둡게)
     * offset 2 또는 (length - 2): brightness 0.6 (더 어둡게)
     * 그 외는 0 (안 보임)
     */
    function calcBrightness(i, current) {
      const offset = getWrapOffset(i, current, images.length);
      if (offset === 0) return 1;
      if (offset === 1 || offset === images.length - 1) return 0.8;
      if (offset === 2 || offset === images.length - 2) return 0.6;
      return 0;
    }
  
    /**
     * i번째 카드의 z-index 계산: 중앙 카드가 가장 높고, 그 다음 양쪽 카드.
     * offset 0 → 10, offset 1 or (length - 1) → 9, offset 2 or (length - 2) → 8.
     */
    function calcZIndex(i, current) {
      const offset = getWrapOffset(i, current, images.length);
      if (offset === 0) return 10;
      if (offset === 1 || offset === images.length - 1) return 9;
      if (offset === 2 || offset === images.length - 2) return 8;
      return 0;
    }
  
    // reactive 선언: currentIndex가 바뀔 때마다 transforms, zIndices, opacities, brightnesses 재계산
    $: {
      transforms = images.map((_, i) => calcTransform(i, currentIndex));
      console.log('transforms:', transforms);
    }
    
    $: {
      zIndices = images.map((_, i) => calcZIndex(i, currentIndex));
      console.log('zIndices:', zIndices);
    }
    
    $: {
      opacities = images.map((_, i) => calcOpacity(i, currentIndex));
      console.log('opacities:', opacities);
    }
    
    $: {
      brightnesses = images.map((_, i) => calcBrightness(i, currentIndex));
      console.log('brightnesses:', brightnesses);
    }

     /* --- 추가된 부분 시작 --- */
    // 각 카드의 이미지에서 대표 색상을 추출해 해당 카드의 CSS 변수 --color-card에 적용
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
    
  <h1>It-Da에서 좋아하는 가수를 검색해보세요</h1>
    
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
    1. 왼쪽 search 탭 클릭<br>s
    2. 음악 검색 후 재생 버튼 클릭<br>
    3. 하단 재생 컨트롤러에서 음원 이미지 클릭
  </p>


