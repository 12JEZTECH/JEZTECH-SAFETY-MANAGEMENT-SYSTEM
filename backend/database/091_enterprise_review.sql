ALTER TABLE enterprise_safety_records ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'DRAFT' CHECK(review_state IN ('DRAFT','SUBMITTED','ACCEPTED','RETURNED'));
ALTER TABLE enterprise_safety_records ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE enterprise_safety_records ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE enterprise_safety_records ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(user_id);
ALTER TABLE enterprise_safety_records ADD COLUMN IF NOT EXISTS review_note text;
CREATE TABLE IF NOT EXISTS enterprise_register_history (
 history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
 record_id uuid NOT NULL REFERENCES enterprise_safety_records(record_id),
 actor_id uuid NOT NULL REFERENCES users(user_id),
 snapshot jsonb NOT NULL,
 action text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE enterprise_register_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_register_history FORCE ROW LEVEL SECURITY;
CREATE POLICY enterprise_history_tenant ON enterprise_register_history USING (tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK (tenant_id::text=current_setting('app.tenant_id',true));
CREATE INDEX IF NOT EXISTS enterprise_history_record_idx ON enterprise_register_history(tenant_id,record_id,created_at);
