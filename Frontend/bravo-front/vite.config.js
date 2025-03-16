// AWS/Frontend/bravo-front/vite.config.js

import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';


export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// 여기에 ngrok 호스트를 추가합니다.
		host: true,
      port: 5174,
		proxy: {
      // Auth Service
      '/api/google': {
        target: 'http://itda-auth.itda-be-ns.svc.cluster.local:3001',
        changeOrigin: true
      },

      // Search Service (Spotify, YouTube, track)
      '/api/spotify': {
        target: 'http://itda-search.itda-be-ns.svc.cluster.local:3002',
        changeOrigin: true
      },
      '/api/youtube': {
        target: 'http://itda-search.itda-be-ns.svc.cluster.local:3002',
        changeOrigin: true
      },
      '/api/track': {
        target: 'http://itda-search.itda-be-ns.svc.cluster.local:3002',
        changeOrigin: true
      },

      // Playlist Service
      '/api/playlist': {
        target: 'http://itda-playlist.itda-be-ns.svc.cluster.local:3005',
        changeOrigin: true
      },

      // Lyrics Service
      '/api/lyrics': {
        target: 'http://itda-lyrics.itda-be-ns.svc.cluster.local:3003',
        changeOrigin: true
      },

      // Translation Service
      '/api/translate': {
        target: 'http://itda-translation.itda-be-ns.svc.cluster.local:3004',
        changeOrigin: true
      }
    },
    // ngrok 등 외부 접근 시 필요한 설정 이거 맞는데 왜 안돼돼
    // allowedHosts: ['valid-elephant-separately.ngrok-free.app', 'valid-elephant-separately.ngrok-free.app:5174']
    allowedHosts: ['popular-incredibly-burro.ngrok-free.app']
    // allowedHosts: 'all'
  },
  // build: {
	// 	rollupOptions: {
	// 		external: ['socket.io-client']
	// 	}
	// }
});
