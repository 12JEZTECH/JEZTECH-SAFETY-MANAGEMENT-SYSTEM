CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name varchar(180) NOT NULL,
  regulatory_framework varchar(180) NOT NULL DEFAULT 'Kenya DOSHS / OSHA / ISO 45001',
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','TRIAL')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  full_name varchar(140) NOT NULL,
  email varchar(180) NOT NULL,
  password_hash text NOT NULL,
  requested_role varchar(32) NOT NULL DEFAULT 'user' CHECK (requested_role IN ('user','safety_department','auditor_officer','admin','super_admin','wall_display_kiosk')),
  role varchar(32) NOT NULL CHECK (role IN ('super_admin','admin','safety_department','auditor_officer','user','wall_display_kiosk')),
  department varchar(120),
  active boolean NOT NULL DEFAULT true,
  pending boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin','admin','safety_department','auditor_officer','user','wall_display_kiosk'));
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_requested_role_check;
ALTER TABLE users ADD CONSTRAINT users_requested_role_check CHECK (requested_role IN ('user','safety_department','auditor_officer','admin','super_admin','wall_display_kiosk'));
CREATE INDEX IF NOT EXISTS users_tenant_role_idx ON users(tenant_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_global_uq ON users(lower(email));
CREATE TABLE IF NOT EXISTS sites (
  site_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  site_name varchar(180) NOT NULL,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, site_name)
);
CREATE TABLE IF NOT EXISTS workspace_state (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES users(user_id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  audit_log_id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  action varchar(160) NOT NULL,
  target_table varchar(100),
  target_record_id uuid,
  ip_address inet,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_date_idx ON audit_logs(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS corrective_actions (
  capa_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to varchar(180),
  due_date date,
  priority varchar(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status varchar(32) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','SUBMITTED_FOR_VERIFICATION','VERIFIED_CLOSED','REJECTED','CLOSED')),
  management_response text,
  evidence_url text,
  verified_by uuid REFERENCES users(user_id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS safety_inspections (
  inspection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,
  auditor_user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  audit_reference_code varchar(60) NOT NULL,
  inspection_type varchar(60) NOT NULL CHECK (inspection_type IN ('ISO_45001_SURVEILLANCE','STATUTORY_DOSH_OSHA','FIRE_ELECTRICAL_AUDIT','MACHINE_GUARDING_LOTO','CHEMICAL_HAZMAT_STORAGE','CONSTRUCTION_SITE_AUDIT','HEALTHCARE_INFECTION_AUDIT')),
  inspected_department varchar(150) NOT NULL,
  inspection_date date NOT NULL DEFAULT CURRENT_DATE,
  overall_compliance_score int CHECK (overall_compliance_score BETWEEN 0 AND 100),
  overall_verdict varchar(40) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (overall_verdict IN ('IN_PROGRESS','SATISFACTORY','CONDITIONAL_PASS','IMMEDIATE_ACTION_REQUIRED')),
  executive_summary_comments text NOT NULL,
  signed_off_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, audit_reference_code)
);
CREATE INDEX IF NOT EXISTS safety_inspections_tenant_date_idx ON safety_inspections(tenant_id, inspection_date DESC);
CREATE TABLE IF NOT EXISTS inspection_findings (
  finding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  inspection_id uuid NOT NULL REFERENCES safety_inspections(inspection_id) ON DELETE CASCADE,
  clause_or_area varchar(180) NOT NULL,
  compliance_status varchar(30) NOT NULL CHECK (compliance_status IN ('CONFORMING','OBSERVATION','MINOR_NC','MAJOR_NC')),
  auditor_comments text NOT NULL,
  recommended_corrective_action text,
  linked_capa_id uuid REFERENCES corrective_actions(capa_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inspection_findings_parent_idx ON inspection_findings(tenant_id, inspection_id, created_at);
CREATE TABLE IF NOT EXISTS management_responses (
  response_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  finding_id uuid NOT NULL REFERENCES inspection_findings(finding_id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES users(user_id),
  response_text text NOT NULL,
  evidence_reference text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS equipment_tags (
  equipment_tag_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
  asset_code varchar(100),
  inspected_department varchar(150) NOT NULL,
  inspection_type varchar(60) NOT NULL,
  token_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, token_id)
);
CREATE TABLE IF NOT EXISTS contractor_gate_passes (
  gate_pass_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,
  pass_code varchar(40) NOT NULL,
  person_name varchar(180) NOT NULL,
  organization varchar(180),
  phone varchar(40),
  person_type varchar(20) NOT NULL CHECK (person_type IN ('CONTRACTOR','VISITOR')),
  induction_expires_at timestamptz,
  purpose text,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  overstay_alert_sent_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, pass_code)
);
CREATE INDEX IF NOT EXISTS gate_pass_open_idx ON contractor_gate_passes(tenant_id, site_id) WHERE checked_in_at IS NOT NULL AND checked_out_at IS NULL;

CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['users','sites','workspace_state','audit_logs','corrective_actions','safety_inspections','inspection_findings','management_responses','equipment_tags','contractor_gate_passes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF t <> 'users' THEN EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t); END IF;
    EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON %I', t);
    EXECUTE format('CREATE POLICY tenant_scope ON %I USING (tenant_id = app_current_tenant_id()) WITH CHECK (tenant_id = app_current_tenant_id())', t);
  END LOOP;
END $$;
