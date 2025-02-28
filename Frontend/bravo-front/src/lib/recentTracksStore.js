// /bravo-front/src/lib/recentTracksStore.js
import { writable } from 'svelte/store';

export const recentTracks = writable([]); // 최근 20곡을 저장할 배열