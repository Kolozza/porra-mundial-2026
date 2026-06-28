-- ============================================================
--  PORRA MUNDIAL 2026 — Supabase schema
--  Pega todo esto en SQL Editor → Run
-- ============================================================

-- Extensión para generar bytes aleatorios
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Tablas ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS players (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text    NOT NULL,
  secret     text    NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  champion   text    NOT NULL DEFAULT '',
  pichichi   text    NOT NULL DEFAULT '',
  preds      jsonb   NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE (name),
  UNIQUE (secret)
);

CREATE TABLE IF NOT EXISTS admin_state (
  id           int  PRIMARY KEY DEFAULT 1,
  open_round   text NOT NULL DEFAULT 'r32',
  locked       jsonb NOT NULL DEFAULT '{}',
  fixtures     jsonb NOT NULL DEFAULT '{}',
  results      jsonb NOT NULL DEFAULT '{}',
  champion     text NOT NULL DEFAULT '',
  pichichi     text NOT NULL DEFAULT '',
  admin_secret text DEFAULT NULL
);

-- Fila inicial del admin (solo una)
INSERT INTO admin_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ── Vistas públicas (sin secretos) ───────────────────────────

CREATE OR REPLACE VIEW v_players AS
  SELECT id, name, champion, pichichi, preds
  FROM players;

CREATE OR REPLACE VIEW v_admin AS
  SELECT
    open_round,
    locked,
    fixtures,
    results,
    champion,
    pichichi,
    (admin_secret IS NOT NULL) AS admin_claimed
  FROM admin_state
  WHERE id = 1;

-- ── Row Level Security (bloquea acceso directo a tablas) ──────

ALTER TABLE players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_state ENABLE ROW LEVEL SECURITY;

-- Las policies bloquean todo; todas las escrituras van por RPC SECURITY DEFINER
DROP POLICY IF EXISTS "block_direct_players"     ON players;
DROP POLICY IF EXISTS "block_direct_admin_state" ON admin_state;

CREATE POLICY "block_direct_players"     ON players     FOR ALL TO anon USING (false);
CREATE POLICY "block_direct_admin_state" ON admin_state FOR ALL TO anon USING (false);

-- Las vistas son accesibles sin RLS (son SELECT sobre las tablas, ejecutadas como owner)
GRANT SELECT ON v_players TO anon;
GRANT SELECT ON v_admin   TO anon;

-- ── Funciones RPC ─────────────────────────────────────────────

-- Crear jugador → devuelve {id, secret}
CREATE OR REPLACE FUNCTION create_player(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id     uuid;
  v_secret text;
BEGIN
  INSERT INTO players (name)
  VALUES (p_name)
  RETURNING id, secret INTO v_id, v_secret;

  RETURN jsonb_build_object('id', v_id::text, 'secret', v_secret);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'unique_violation: ese nombre ya existe';
END;
$$;

-- Guardar pronósticos de una ronda (merge en preds)
CREATE OR REPLACE FUNCTION save_predictions(
  p_secret     text,
  p_round      text,
  p_round_preds jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_locked boolean;
BEGIN
  -- Comprueba si la ronda está cerrada
  SELECT COALESCE((locked->p_round)::boolean, false)
  INTO v_locked
  FROM admin_state WHERE id = 1;

  IF v_locked THEN RETURN false; END IF;

  UPDATE players
  SET preds = preds || jsonb_build_object(p_round, p_round_preds)
  WHERE secret = p_secret;

  RETURN FOUND;
END;
$$;

-- Guardar apuestas de futuro (campeón + pichichi)
CREATE OR REPLACE FUNCTION save_futures(
  p_secret    text,
  p_champion  text,
  p_pichichi  text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_open_round text;
  v_r32_locked boolean;
BEGIN
  SELECT open_round, COALESCE((locked->'r32')::boolean, false)
  INTO v_open_round, v_r32_locked
  FROM admin_state WHERE id = 1;

  -- Las apuestas de futuro se bloquean si r32 está cerrado o ya no es la ronda abierta
  IF v_r32_locked OR v_open_round <> 'r32' THEN RETURN false; END IF;

  UPDATE players
  SET champion = p_champion, pichichi = p_pichichi
  WHERE secret = p_secret;

  RETURN FOUND;
END;
$$;

-- Reclamar panel de admin (primera vez)
CREATE OR REPLACE FUNCTION admin_claim(p_secret text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE admin_state
  SET admin_secret = p_secret
  WHERE id = 1 AND admin_secret IS NULL;

  RETURN FOUND;
END;
$$;

-- Verificar secreto de admin
CREATE OR REPLACE FUNCTION admin_login(p_secret text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_state WHERE id = 1 AND admin_secret = p_secret
  );
$$;

-- Guardar estado de admin
CREATE OR REPLACE FUNCTION admin_save(
  p_admin_secret text,
  p_patch        jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_state WHERE id = 1 AND admin_secret = p_admin_secret
  ) THEN
    RETURN false;
  END IF;

  UPDATE admin_state SET
    open_round = COALESCE(p_patch->>'open_round', open_round),
    locked     = CASE WHEN p_patch ? 'locked'   THEN p_patch->'locked'   ELSE locked   END,
    fixtures   = CASE WHEN p_patch ? 'fixtures' THEN p_patch->'fixtures' ELSE fixtures END,
    results    = CASE WHEN p_patch ? 'results'  THEN p_patch->'results'  ELSE results  END,
    champion   = COALESCE(p_patch->>'champion', champion),
    pichichi   = COALESCE(p_patch->>'pichichi', pichichi)
  WHERE id = 1;

  RETURN true;
END;
$$;

-- ── Permisos de ejecución ─────────────────────────────────────

GRANT EXECUTE ON FUNCTION create_player(text)                   TO anon;
GRANT EXECUTE ON FUNCTION save_predictions(text, text, jsonb)   TO anon;
GRANT EXECUTE ON FUNCTION save_futures(text, text, text)        TO anon;
GRANT EXECUTE ON FUNCTION admin_claim(text)                     TO anon;
GRANT EXECUTE ON FUNCTION admin_login(text)                     TO anon;
GRANT EXECUTE ON FUNCTION admin_save(text, jsonb)               TO anon;
