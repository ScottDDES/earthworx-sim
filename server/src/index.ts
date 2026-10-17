// The public board for Earthworx Sim's seasons. A Cloudflare Worker with one database (D1).
//
//   GET  /v1/board/:season[?player=id]   the top scores on the current engine version (and your own place)
//   POST /v1/scores                      { season, player, name, co, v, moves }: the server plays the moves again
//                                        with the game's own engine, and the score it works out is the one kept
//
// Nobody can post a score, only moves: whatever the moves earn is the score. Each player keeps their best.

import { SIM_VER, replaySeason, seasonDef } from '../../src/seasons';
import { BOARD_ROWS, MAX_BODY, ORIGINS, POSTS_PER_HOUR, hash, readPost } from './rules';

interface Env {
  DB: D1Database;
}

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('Origin') || '';
  return ORIGINS.includes(o) ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {};
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req) } });

interface Row {
  name: string;
  co: string;
  score: number;
  week: number;
  at: number;
}

async function board(req: Request, env: Env, season: string, player: string | null) {
  if (!seasonDef(season)) return json(req, { error: 'No such season.' }, 404);
  const top = await env.DB.prepare('SELECT name, co, score, week, at FROM scores WHERE season = ? AND v = ? AND hidden = 0 ORDER BY score DESC, at ASC LIMIT ?')
    .bind(season, SIM_VER, BOARD_ROWS).all<Row>();
  let me: (Row & { rank: number }) | null = null;
  if (player && /^[A-Za-z0-9-]{16,64}$/.test(player)) {
    const id = await hash(player);
    const mine = await env.DB.prepare('SELECT name, co, score, week, at FROM scores WHERE season = ? AND player = ? AND v = ? AND hidden = 0').bind(season, id, SIM_VER).first<Row>();
    if (mine) {
      const above = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE season = ? AND v = ? AND hidden = 0 AND (score > ? OR (score = ? AND at < ?))')
        .bind(season, SIM_VER, mine.score, mine.score, mine.at).first<{ n: number }>();
      me = { ...mine, rank: (above?.n ?? 0) + 1 };
    }
  }
  return json(req, { season, v: SIM_VER, rows: top.results, me });
}

async function post(req: Request, env: Env) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return json(req, { error: 'That recording is too big.' }, 413);
  const text = await req.text();
  if (text.length > MAX_BODY) return json(req, { error: 'That recording is too big.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(req, { error: 'Not a score.' }, 400);
  }
  const r = readPost(body);
  if (!r.ok) return json(req, { error: r.why }, 400);
  const p = r.post;
  if (!seasonDef(p.season)) return json(req, { error: 'No such season.' }, 404);
  if (p.v !== SIM_VER) return json(req, { error: 'This score is from another version of the game. Update the app to post scores.', v: SIM_VER }, 409);

  // a few posts an hour from any one address
  const now = Date.now(), ip = await hash(req.headers.get('CF-Connecting-IP') || 'unknown');
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM posts WHERE ip = ? AND at > ?').bind(ip, now - 3600_000).first<{ n: number }>();
  if ((recent?.n ?? 0) >= POSTS_PER_HOUR) return json(req, { error: 'Too many scores posted from here. Try again in an hour.' }, 429);
  await env.DB.prepare('INSERT INTO posts (ip, at) VALUES (?, ?)').bind(ip, now).run();

  // the only score that counts is the one the moves earn
  const rep = replaySeason(p.season, p.moves, p.co);
  if (!rep.ok) return json(req, { error: "That season didn't play back the same, so it can't go on the board.", why: rep.why }, 422);

  const player = await hash(p.player);
  // keep each player's best; a new name or company is taken whenever they post
  await env.DB.prepare(
    `INSERT INTO scores (season, player, name, co, score, week, v, moves, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (season, player) DO UPDATE SET
       name = excluded.name, co = excluded.co,
       score = CASE WHEN excluded.score > scores.score OR scores.v <> excluded.v THEN excluded.score ELSE scores.score END,
       week  = CASE WHEN excluded.score > scores.score OR scores.v <> excluded.v THEN excluded.week ELSE scores.week END,
       moves = CASE WHEN excluded.score > scores.score OR scores.v <> excluded.v THEN excluded.moves ELSE scores.moves END,
       at    = CASE WHEN excluded.score > scores.score OR scores.v <> excluded.v THEN excluded.at ELSE scores.at END,
       v = excluded.v`,
  ).bind(p.season, player, p.name, p.co, rep.score, rep.week, SIM_VER, p.moves.length, now).run();
  // tidy the rate-limit log now and then
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM posts WHERE at < ?').bind(now - 86400_000).run();

  const res = await board(req, env, p.season, p.player);
  const b = (await res.json()) as { me: unknown };
  return json(req, { score: rep.score, week: rep.week, me: b.me });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url);
    try {
      const m = url.pathname.match(/^\/v1\/board\/([a-z0-9]+)$/);
      if (req.method === 'GET' && m) return await board(req, env, m[1]!, url.searchParams.get('player'));
      if (req.method === 'POST' && url.pathname === '/v1/scores') return await post(req, env);
      if (req.method === 'GET' && url.pathname === '/') return json(req, { board: 'Earthworx Sim', v: SIM_VER });
      return json(req, { error: 'Not found.' }, 404);
    } catch (e) {
      return json(req, { error: 'Something went wrong on the board.', detail: String((e as Error)?.message || e) }, 500);
    }
  },
};
