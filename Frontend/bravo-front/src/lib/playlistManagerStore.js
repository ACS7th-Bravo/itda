// /bravo-front/src/lib/playlistManagerStore.js

import { writable } from 'svelte/store';

/*
  playlistManager 스토어는 그룹 객체 배열을 관리합니다.
  각 그룹 객체의 구조는 아래와 같습니다.
  {
    id: number,
    name: string,
    tracks: Array<{
      name: string,
      artist: string,
      albumImage: string,
      videoId?: string
    }>
  }
*/
export const playlistManager = writable([]);

/*
  특정 그룹에 트랙을 추가하는 함수

  매개변수:
  - groupId: 트랙을 추가할 그룹의 고유 ID
  - track: 추가할 트랙 객체

  함수는 현재 스토어에 저장된 그룹 배열을 업데이트하여,
  해당 그룹의 tracks 배열에 새 트랙을 추가합니다.
*/
export function addTrackToGroup(groupId, track) {
	playlistManager.update((groups) => {
		return groups.map((group) => {
			if (group.id === groupId) {
				return { ...group, tracks: [...group.tracks, track] };
			}
			return group;
		});
	});
}