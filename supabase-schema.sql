-- =====================================================
-- Quran AI Assistant — Supabase SQL Schema
-- Paste this entire file into:
--   Supabase Dashboard → SQL Editor → New Query → Run
-- =====================================================

-- 1. Recitation Sessions
--    Stores every Tajweed analysis result
CREATE TABLE IF NOT EXISTS recitation_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surah       TEXT NOT NULL,
  ayah        TEXT DEFAULT '',
  score       INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  words       JSONB NOT NULL DEFAULT '[]',
  mode        TEXT NOT NULL DEFAULT 'tajweed' CHECK (mode IN ('tajweed', 'interactive', 'kids')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_created ON recitation_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_score   ON recitation_sessions (score DESC);

-- 2. Ijazah Certification Applications
CREATE TABLE IF NOT EXISTS ijazah_applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surah        TEXT NOT NULL,
  accuracy     NUMERIC(5,2) NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','ai_approved','sheikh_review','approved','rejected')),
  sheikh_notes TEXT DEFAULT '',
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ijazah_status  ON ijazah_applications (status);
CREATE INDEX IF NOT EXISTS idx_ijazah_created ON ijazah_applications (created_at DESC);

-- 3. Users (ready for future auth integration)
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  avatar           TEXT DEFAULT '',
  points           INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  badges           TEXT[] NOT NULL DEFAULT '{}',
  streak           INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
  total_verses     INTEGER NOT NULL DEFAULT 0 CHECK (total_verses >= 0),
  tajweed_accuracy NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tajweed_accuracy BETWEEN 0 AND 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Mushaf Bookmarks & Favorites
CREATE TABLE IF NOT EXISTS mushaf_bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verse_key   TEXT NOT NULL,
  surah_name  TEXT NOT NULL,
  ayah_number INTEGER NOT NULL,
  page_number INTEGER NOT NULL,
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_verse ON mushaf_bookmarks (verse_key);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON mushaf_bookmarks (created_at DESC);

-- Optional: seed a default user for testing
-- INSERT INTO users (name) VALUES ('مستخدم تجريبي');

-- Verify tables were created:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

