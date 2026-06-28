-- ============================================================
--  Migración: añadir recuperación por PIN
--  Ejecuta esto en SQL Editor DESPUÉS de haber corrido supabase-porra.sql
-- ============================================================

-- Añadir columna pin a players
ALTER TABLE players ADD COLUMN IF NOT EXISTS pin text DEFAULT NULL;

-- Actualizar create_player para aceptar PIN opcional
CREATE OR REPLACE FUNCTION create_player(p_name text, p_pin text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id     uuid;
  v_secret text;
BEGIN
  INSERT INTO players (name, pin)
  VALUES (
    p_name,
    CASE WHEN p_pin IS NOT NULL AND p_pin <> ''
      THEN encode(digest(p_pin, 'sha256'), 'hex')
      ELSE NULL
    END
  )
  RETURNING id, secret INTO v_id, v_secret;

  RETURN jsonb_build_object('id', v_id::text, 'secret', v_secret);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'unique_violation: ese nombre ya existe';
END;
$$;

-- Nueva función: recuperar cuenta con nombre + PIN
CREATE OR REPLACE FUNCTION recover_player(p_name text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id     uuid;
  v_secret text;
BEGIN
  SELECT id, secret INTO v_id, v_secret
  FROM players
  WHERE name = p_name
    AND pin = encode(digest(p_pin, 'sha256'), 'hex');

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object('id', v_id::text, 'secret', v_secret);
END;
$$;

GRANT EXECUTE ON FUNCTION create_player(text, text) TO anon;
GRANT EXECUTE ON FUNCTION recover_player(text, text)  TO anon;
