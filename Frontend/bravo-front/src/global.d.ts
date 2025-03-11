/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module '*.svelte' {
    import type { SvelteComponentTyped } from 'svelte';
    const component: SvelteComponentTyped<{}>;
    export default component;
  }
  
  // 아래는 ProductCard.svelte에 대한 구체적인 타입 선언입니다.
declare module '$lib/components/ui/HeroParallax/ProductCard.svelte' {
  import type { SvelteComponent } from 'svelte';
  import type { MotionValue } from 'svelte-motion';

  interface Product {
    title: string;
    link: string;
    thumbnail: string;
  }

  interface ProductCardProps {
    product: Product;
    translate: MotionValue<number>;
  }

  export default class ProductCard extends SvelteComponent<ProductCardProps> {}
}