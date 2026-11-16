-- Security foundation: MFA readiness, lockout metadata, security event ledger and immutable audit history.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_secret_ciphertext text,
  ADD COLUMN IF NOT EXISTS mfa_recovery_code_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS security_events (
  security_event_id bigserial PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  event_type varchar(100) NOT NULL,
  severity varchar(20) NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO','WARN','HIGH','CRITICAL')),
  source_ip inet,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_tenant_time_idx ON security_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_events_type_time_idx ON security_events(event_type, occurred_at DESC);
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS security_events_tenant_scope ON security_events;
CREATE POLICY security_events_tenant_scope ON security_events
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only; create a compensating event instead'
    USING ERRCODE = '55000';
END;
$$;
DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
