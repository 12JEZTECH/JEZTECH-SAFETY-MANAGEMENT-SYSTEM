CREATE TABLE IF NOT EXISTS statutory_inspection_schedule (
schedule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(tenant_id), site_id uuid NOT NULL REFERENCES sites(site_id), obligation text NOT NULL, authority text NOT NULL, due_date date NOT NULL, created_by uuid NOT NULL REFERENCES users(user_id), created_at timestamptz NOT NULL DEFAULT now(), inspection_id uuid REFERENCES safety_inspections(inspection_id), completed_at timestamptz);
CREATE INDEX IF NOT EXISTS statutory_schedule_tenant_due ON statutory_inspection_schedule(tenant_id,due_date);
ALTER TABLE statutory_inspection_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_inspection_schedule FORCE ROW LEVEL SECURITY;
CREATE POLICY statutory_schedule_tenant ON statutory_inspection_schedule USING (tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK (tenant_id::text=current_setting('app.tenant_id',true));
