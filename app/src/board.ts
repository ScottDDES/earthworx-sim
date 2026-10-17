// Talking to the public board. The board's address comes from VITE_BOARD_URL when the app is built (empty until
// the server is on Cloudflare, and then the board just says it isn't up yet). The app never sends a score: it sends
// the season's moves, and the server plays them again to get the score.

import { SIM_VER, type SeasonState, game } from '@engine';

export const BOARD_URL: string = (import.meta.env.VITE_BOARD_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export interface BoardRow {
  name: string;
  co: string;
  score: number;
  week: number;
  at: number;
}
export interface Board {
  rows: BoardRow[];
  me: (BoardRow & { rank: number }) | null;
}

const PLAYER_KEY = 'earthworx-player', NAME_KEY = 'earthworx-nickname';

/** This device's player id: random, made once, kept on the device. The board only ever sees a hash of it. */
export function playerId(): string {
  try {
    let id = localStorage.getItem(PLAYER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(PLAYER_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BOARD_URL) throw new Error("The board isn't up yet.");
  let res: Response;
  try {
    res = await fetch(BOARD_URL + path, { ...init, headers: { 'Content-Type': 'application/json' } });
  } catch {
    throw new Error("Couldn't reach the board. Check you're online and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || 'The board said no.');
  return body;
}

export function getBoard(season: string): Promise<Board> {
  return call<Board>(`/v1/board/${season}?player=${encodeURIComponent(playerId())}`);
}

/** Post a finished season's moves under a nickname. Resolves to the score the board worked out, and your place. */
export async function postScore(c: game.Career, name: string): Promise<{ score: number; week: number; me: Board['me'] }> {
  const S = c.season as SeasonState;
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // just won't be remembered
  }
  return call('/v1/scores', { method: 'POST', body: JSON.stringify({ season: S.id, player: playerId(), name, co: c.co, v: SIM_VER, moves: c.alog }) });
}
