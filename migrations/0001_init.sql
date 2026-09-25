-- Casa / hogar: agrupa a los usuarios que comparten la misma lista.
CREATE TABLE households (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  household_id  TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_users_household ON users(household_id);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Supermercados, con orden manual para poder ordenar la lista por tienda.
CREATE TABLE stores (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  color        TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_stores_household ON stores(household_id, sort_order);

-- Artículos. Todo lo opcional es NULL por defecto: se puede usar solo con el nombre.
CREATE TABLE items (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  qty          TEXT,
  category     TEXT,
  note         TEXT,
  store_id     TEXT REFERENCES stores(id) ON DELETE SET NULL,
  photo_key    TEXT,
  done         INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_items_household ON items(household_id, done, sort_order);
