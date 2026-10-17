-- The public board: one row per player per season (their best), and a log of posts for rate limiting.
-- Players are a random id the app makes on the device; only its hash is stored, and it's never shown.

CREATE TABLE IF NOT EXISTS scores (
  season   TEXT    NOT NULL,
  player   TEXT    NOT NULL,          -- sha-256 of the device's id
  name     TEXT    NOT NULL,          -- the nickname shown on the board
  co       TEXT    NOT NULL,          -- the company name they played under
  score    INTEGER NOT NULL,          -- net worth gained, as the server's replay worked it out
  week     INTEGER NOT NULL,          -- weeks played
  v        INTEGER NOT NULL,          -- the engine version it was replayed on
  moves    INTEGER NOT NULL,          -- how many moves the recording had
  at       INTEGER NOT NULL,          -- when it was posted (ms)
  hidden   INTEGER NOT NULL DEFAULT 0, -- 1 = taken off the board by the owner
  PRIMARY KEY (season, player)
);
CREATE INDEX IF NOT EXISTS scores_board ON scores (season, v, hidden, score DESC);

CREATE TABLE IF NOT EXISTS posts (
  ip  TEXT    NOT NULL,                -- sha-256 of the address, for rate limiting only
  at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_ip ON posts (ip, at);
