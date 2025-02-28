// *** NEW: fakeuserStore.js - 페이크 로그인 사용자 정보를 관리하는 스토어 ***
import { writable } from 'svelte/store';
export const fakeUser = writable(null);
