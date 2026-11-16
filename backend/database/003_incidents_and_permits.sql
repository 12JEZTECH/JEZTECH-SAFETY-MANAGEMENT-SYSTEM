-- Incident and permit-to-work records with tenant isolation and immutable revisions.
CREATE TABLE IF NOT EXISTS safety_incidents (
 incident_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
 site_id uuid REFERENCES sites(site_id) ON DELETE RESTRICT,
 reference_code varchar(60) NOT NULL,
 incident_type varchar(40) NOT NULL CHECK (incident_type IN ('INJURY','NEAR_MISS','DANGEROUS_OCCURRENCE','PROPERTY_DAMAGE','ENVIRONMENTAL','FIRE')),
 title varchar(220) NOT NULL,
 description text NOT NULL,
 occurred_at timestamptz NOT NULL,
 reported_by uuid NOT NULL REFERENCES users(user_id),
 severity varchar(20) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
 status varchar(30) NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('REPORTED','UNDER_INVESTIGATION','ACTIONS_ASSIGNED','PENDING_VERIFICATION','CLOSED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,reference_code)
);
CREATE TABLE IF NOT EXISTS incident_revisions (
 revision_id bigserial PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
 incident_id uuid NOT NULL REFERENCES safety_incidents(incident_id) ON DELETE RESTRICT,
 revision_number integer NOT NULL,
 changed_by uuid NOT NULL REFERENCES users(user_id),
 change_reason text NOT NULL,
 snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,incident_id,revision_number)
);
CREATE TABLE IF NOT EXISTS permit_to_work (
 permit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
 site_id uuid NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,
 permit_code varchar(60) NOT NULL,
 work_type varchar(50) NOT NULL CHECK (work_type IN ('HOT_WORK','CONFINED_SPACE','WORK_AT_HEIGHT','ELECTRICAL','EXCAVATION','GENERAL')),
 work_description text NOT NULL,
 hazards jsonb NOT NULL DEFAULT '[]'::jsonb,
 controls jsonb NOT NULL DEFAULT '[]'::jsonb,
 requested_by uuid NOT NULL REFERENCES users(user_id),
 approved_by uuid REFERENCES users(user_id),
 status varchar(24) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','SUSPENDED','CLOSED')),
 valid_from timestamptz,
 valid_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,permit_code)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['safety_incidents','incident_revisions','permit_to_work'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON %I',t);
  EXECUTE format('CREATE POLICY tenant_scope ON %I USING (tenant_id=app_current_tenant_id()) WITH CHECK (tenant_id=app_current_tenant_id())',t);
 END LOOP;
END $;
ALTER TABLE corrective_actions ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0;
ALTER TABLE corrective_actions ADD COLUMN IF NOT EXISTS last_escalated_at timestamptz;
CREATE OR REPLACE FUNCTION prevent_incident_revision_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Incident revisions are immutable'; END $$;
DROP TRIGGER IF EXISTS incident_revisions_no_update ON incident_revisions;
CREATE TRIGGER incident_revisions_no_update BEFORE UPDATE OR DELETE ON incident_revisions FOR EACH ROW EXECUTE FUNCTION prevent_incident_revision_mutation();

CREATE OR REPLACE FUNCTION prevent_submitted_incident_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Incident records cannot be deleted; amend with a revision'; END $$;
DROP TRIGGER IF EXISTS safety_incidents_no_delete ON safety_incidents;
CREATE TRIGGER safety_incidents_no_delete BEFORE DELETE ON safety_incidents FOR EACH ROW EXECUTE FUNCTION prevent_submitted_incident_delete();
