CREATE TABLE IF NOT EXISTS enterprise_safety_records (
 record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
 module text NOT NULL,
 title text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_by uuid NOT NULL REFERENCES users(user_id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enterprise_safety_records_tenant_module_idx ON enterprise_safety_records(tenant_id,module,created_at DESC);
ALTER TABLE enterprise_safety_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_safety_records FORCE ROW LEVEL SECURITY;
CREATE POLICY enterprise_safety_records_tenant ON enterprise_safety_records USING (tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK (tenant_id::text=current_setting('app.tenant_id',true));
