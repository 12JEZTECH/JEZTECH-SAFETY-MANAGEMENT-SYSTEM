-- Relational hazard register and corrective-action workflow.
CREATE TABLE IF NOT EXISTS safety_hazards (
  hazard_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
  site_id uuid REFERENCES sites(site_id) ON DELETE RESTRICT,
  reference_code varchar(60) NOT NULL,
  title varchar(220) NOT NULL,
  description text NOT NULL,
  hazard_category varchar(60) NOT NULL,
  severity smallint NOT NULL CHECK (severity BETWEEN 1 AND 5),
  likelihood smallint NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  regulatory_impact smallint NOT NULL CHECK (regulatory_impact BETWEEN 1 AND 5),
  business_impact smallint NOT NULL CHECK (business_impact BETWEEN 1 AND 5),
  risk_score integer GENERATED ALWAYS AS ((severity * 5) + (likelihood * 3) + (regulatory_impact * 4) + (business_impact * 3)) STORED,
  priority varchar(2) GENERATED ALWAYS AS (CASE WHEN ((severity * 5) + (likelihood * 3) + (regulatory_impact * 4) + (business_impact * 3)) >= 80 THEN 'P0' WHEN ((severity * 5) + (likelihood * 3) + (regulatory_impact * 4) + (business_impact * 3)) >= 60 THEN 'P1' WHEN ((severity * 5) + (likelihood * 3) + (regulatory_impact * 4) + (business_impact * 3)) >= 40 THEN 'P2' ELSE 'P3' END) STORED,
  identified_by uuid NOT NULL REFERENCES users(user_id),
  owner_user_id uuid REFERENCES users(user_id),
  status varchar(24) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_TREATMENT','CONTROLLED','CLOSED')),
  control_measures jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, reference_code)
);
CREATE TABLE IF NOT EXISTS safety_corrective_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
  hazard_id uuid REFERENCES safety_hazards(hazard_id) ON DELETE RESTRICT,
  incident_id uuid REFERENCES safety_incidents(incident_id) ON DELETE RESTRICT,
  reference_code varchar(60) NOT NULL,
  title varchar(220) NOT NULL,
  description text NOT NULL,
  assigned_to uuid NOT NULL REFERENCES users(user_id),
  due_date date NOT NULL,
  priority varchar(12) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status varchar(24) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','PENDING_VERIFICATION','VERIFIED_CLOSED','REJECTED')),
  completion_evidence text,
  verified_by uuid REFERENCES users(user_id),
  verified_at timestamptz,
  escalation_level integer NOT NULL DEFAULT 0,
  last_escalated_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, reference_code),
  CHECK (hazard_id IS NOT NULL OR incident_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS safety_hazards_tenant_priority_idx ON safety_hazards(tenant_id, priority, status);
CREATE INDEX IF NOT EXISTS safety_capa_tenant_due_idx ON safety_corrective_actions(tenant_id, due_date, status);
DO $policy$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['safety_hazards','safety_corrective_actions'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON %I',t);
  EXECUTE format('CREATE POLICY tenant_scope ON %I USING (tenant_id=app_current_tenant_id()) WITH CHECK (tenant_id=app_current_tenant_id())',t);
 END LOOP;
END $policy$;
