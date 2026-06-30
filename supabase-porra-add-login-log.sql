-- Migration: add login_log table and RPCs

CREATE TABLE login_log (
  id          bigserial PRIMARY KEY,
  player_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  logged_at   timestamptz NOT NULL DEFAULT now(),
  method      text NOT NULL DEFAULT 'session'
  -- method values: 'register' | 'link' | 'session' | 'recovery'
);

ALTER TABLE login_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY login_log_deny ON login_log FOR ALL TO anon USING (false);

-- Called by the frontend on every login event (fire-and-forget)
CREATE OR REPLACE FUNCTION log_login(p_player_id uuid, p_method text DEFAULT 'session')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO login_log (player_id, method) VALUES (p_player_id, p_method);
END;
$$;
GRANT EXECUTE ON FUNCTION log_login(uuid, text) TO anon;

-- Called by the admin panel to read the log
CREATE OR REPLACE FUNCTION admin_get_login_log(p_admin_secret text)
RETURNS TABLE (
  player_name text,
  logged_at   timestamptz,
  method      text
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_state WHERE id = 1 AND admin_secret = p_admin_secret
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.name, l.logged_at, l.method
    FROM login_log l
    JOIN players p ON p.id = l.player_id
    ORDER BY l.logged_at DESC
    LIMIT 500;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_login_log(text) TO anon;
