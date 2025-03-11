<script>
    import { Motion } from 'svelte-motion';
  
    export let product = {};
    export let translate = 0;
  </script>
  
  <Motion let:motion style={{ x: translate }} whileHover={{ y: -20 }}>
    <div use:motion class="group/product relative h-40 w-40 md:w-40">
      <a href={product.link} class="block group-hover/product:shadow-2xl">
        <img
          src={product.thumbnail}
          height="160"
          width="160"
          class="absolute inset-0 h-full w-full object-cover object-left-top"
          alt={product.title}
        />
      </a>
      <div class="pointer-events-none absolute inset-0 h-full w-full bg-black opacity-0 group-hover/product:opacity-80"></div>
      <h2 class="absolute bottom-2 left-2 text-white text-sm opacity-0 group-hover/product:opacity-100">
        {product.title}
      </h2>
    </div>
  </Motion>
  