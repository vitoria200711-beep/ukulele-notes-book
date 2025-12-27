export interface StoredSongCifra {
  cifra?: string;
}

const KEY = 'ukulele-song-cifra-v1';

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function getCifraMap(): Record<string, StoredSongCifra> {
  return safeParse<Record<string, StoredSongCifra>>(localStorage.getItem(KEY)) || {};
}

export function setSongCifra(songId: string, cifra: string) {
  const map = getCifraMap();
  map[songId] = { ...(map[songId] || {}), cifra };
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function getSongCifra(songId: string): string | undefined {
  return getCifraMap()[songId]?.cifra;
}

export function mergeSongsWithCifra<T extends { id: string }>(songs: T[]): Array<T & { cifra?: string }> {
  const map = getCifraMap();
  return songs.map((s) => ({ ...s, cifra: map[s.id]?.cifra }));
}


