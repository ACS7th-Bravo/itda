// AWS/Frontend/bravo-front/svelte.config.js


import adapter from '@sveltejs/adapter-node';
import { sveltePreprocess } from 'svelte-preprocess'; // ⬅ 이렇게

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: sveltePreprocess(),
	kit: {
		adapter: adapter({out:'build'})
	},
	vitePlugin: {
		experimental: {
			useVitePreprocess: true
		}
	}
};

export default config;
