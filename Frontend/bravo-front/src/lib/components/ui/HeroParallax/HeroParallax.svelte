<script>
    export let products = [];
  
    import { Motion, useTransform, useSpring, useViewportScroll } from 'svelte-motion';
    import ProductCard from '$lib/components/ui/HeroParallax/ProductCard.svelte';
  
    const row1 = products.slice(0, 4);
    const row2 = products.slice(4, 8);
    const row3 = products.slice(8, 12);
    const row4 = products.slice(12, 16);
  
    let ref = null;
    const { scrollYProgress } = useViewportScroll();
    const springConfig = { stiffness: 300, damping: 30, bounce: 100 };
  
    const translateX = useSpring(useTransform(scrollYProgress, [0, 1], [0, 1000]), springConfig);
    const translateXReverse = useSpring(useTransform(scrollYProgress, [0, 1], [0, -1000]), springConfig);
    const rotateX = useSpring(useTransform(scrollYProgress, [0, 1], [15, 0]), springConfig);
    const opacity = useSpring(useTransform(scrollYProgress, [0, 1], [0.2, 1]), springConfig);
    const rotateZ = useSpring(useTransform(scrollYProgress, [0, 1], [20, 0]), springConfig);
    const translateY = useSpring(useTransform(scrollYProgress, [0, 1], [-700, 500]), springConfig);
  </script>
  
  <div bind:this={ref} class="relative flex h-[300vh] flex-col self-auto overflow-hidden py-4 antialiased [perspective:1000px] [transform-style:preserve-3d]">
    <div class="relative left-0 top-0 mx-auto w-full max-w-7xl px-4 py-8 md:py-4">
      <h2 class="text-2xl font-bold dark:text-white md:text-7xl">
        The Ultimate <br /> development studio
      </h2>
      <p class="mt-8 max-w-2xl text-base dark:text-neutral-200 md:text-xl">
        We build beautiful products with the latest technologies and frameworks. We are a team of passionate developers and designers that love to build amazing products.
      </p>
    </div>
    
    <Motion let:motion style={{ rotateX, rotateZ, translateY, opacity }}>
      <div use:motion class="mx-auto max-w-[1088px] w-full">
        <div class="mb-10 grid grid-cols-4 gap-4">
          {#each row1 as product (product.title)}
            <ProductCard {product} translate={translateX} />
          {/each}
        </div>
        <div class="mb-10 grid grid-cols-4 gap-4">
          {#each row2 as product (product.title)}
            <ProductCard {product} translate={translateXReverse} />
          {/each}
        </div>
        <div class="mb-10 grid grid-cols-4 gap-4">
          {#each row3 as product (product.title)}
            <ProductCard {product} translate={translateX} />
          {/each}
        </div>
        <div class="grid grid-cols-4 gap-4">
          {#each row4 as product (product.title)}
            <ProductCard {product} translate={translateXReverse} />
          {/each}
        </div>
      </div>
    </Motion>
  </div>
  