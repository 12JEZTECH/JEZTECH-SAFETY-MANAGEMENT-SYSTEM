-- Release governance data model: tenant-scoped milestones, epics, stories, risks,
-- readiness controls, sprint capacity and approval evidence.
CREATE TABLE IF NOT EXISTS release_projects (
  project_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  project_name varchar(180) NOT NULL,
  release_version varchar(60),
  start_date date,
  target_release_date date,
  status varchar(24) NOT NULL DEFAULT 'PLANNING'
    CHECK (status IN ('PLANNING','IN_PROGRESS','AT_RISK','BLOCKED','READY','RELEASED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, project_name, release_version)
);
CREATE TABLE IF NOT EXISTS release_epics (
  epic_id varchar(40) NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES release_projects(project_id) ON DELETE CASCADE,
  epic_name varchar(180) NOT NULL,
  description text,
  owner_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  owner_role varchar(100),
  status varchar(24) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
  target_sprint varchar(40),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, epic_id)
);
CREATE TABLE IF NOT EXISTS release_sprints (
  sprint_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES release_projects(project_id) ON DELETE CASCADE,
  sprint_name varchar(60) NOT NULL,
  starts_on date,
  ends_on date,
  capacity_points integer NOT NULL DEFAULT 0 CHECK (capacity_points >= 0),
  committed_points integer NOT NULL DEFAULT 0 CHECK (committed_points >= 0),
  completed_points integer NOT NULL DEFAULT 0 CHECK (completed_points >= 0),
  status varchar(20) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED','ACTIVE','COMPLETE','CANCELLED')),
  UNIQUE (tenant_id, project_id, sprint_name)
);
CREATE TABLE IF NOT EXISTS release_tickets (
  ticket_id varchar(40) NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES release_projects(project_id) ON DELETE CASCADE,
  epic_id varchar(40),
  title varchar(240) NOT NULL,
  description text,
  issue_type varchar(20) NOT NULL DEFAULT 'Story'
    CHECK (issue_type IN ('Epic','Story','Task','Bug','Sub-task')),
  priority varchar(20) NOT NULL DEFAULT 'Medium'
    CHECK (priority IN ('Highest','High','Medium','Low','Lowest')),
  story_points integer CHECK (story_points IS NULL OR story_points >= 0),
  sprint varchar(60),
  owner_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  assignee_label varchar(120),
  status varchar(24) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','BLOCKED','IN_REVIEW','DONE','CANCELLED')),
  risk_score integer CHECK (risk_score IS NULL OR risk_score BETWEEN 0 AND 100),
  due_date date,
  labels text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, ticket_id),
  FOREIGN KEY (tenant_id, epic_id) REFERENCES release_epics(tenant_id, epic_id) ON DELETE SET NULL (epic_id)
);
CREATE INDEX IF NOT EXISTS release_tickets_project_status_idx
  ON release_tickets(tenant_id, project_id, status, priority);
CREATE INDEX IF NOT EXISTS release_tickets_due_idx
  ON release_tickets(tenant_id, due_date) WHERE status <> 'DONE';
CREATE TABLE IF NOT EXISTS release_milestones (
  milestone_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES release_projects(project_id) ON DELETE CASCADE,
  milestone_code varchar(20) NOT NULL,
  milestone_name varchar(180) NOT NULL,
  target_sprint varchar(40),
  target_date date,
  exit_criteria text NOT NULL,
  executive_owner varchar(120),
  delivery_owner varchar(120),
  owner_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  status varchar(24) NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (status IN ('NOT_STARTED','IN_PROGRESS','AT_RISK','BLOCKED','ACHIEVED','WAIVED')),
  achieved_at timestamptz,
  evidence_link text,
  UNIQUE (tenant_id, project_id, milestone_code)
);
CREATE TABLE IF NOT EXISTS release_risks (
  risk_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES release_projects(project_id) ON DELETE CASCADE,
  ticket_id varchar(40),
  title varchar(240) NOT NULL,
  severity smallint NOT NULL CHECK (severity BETWEEN 1 AND 5),
  likelihood smallint NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  regulatory_impact smallint NOT NULL CHECK (regulatory_impact BETWEEN 1 AND 5),
  business_impact smallint NOT NULL CHECK (business_impact BETWEEN 1 AND 5),
  calculated_score integer GENERATED ALWAYS AS
    ((severity * 5) + (likelihood * 3) + (regulatory_impact * 4) + (business_impact * 3)) STORED,
  priority varchar(12) GENERATED ALWAYS AS (
    CASE
      WHEN ((severity * 5) + (likelihood * 3) + (regulatory_impact * 4) + (business_impact * 3)) >= 80 THEN 'P0'
      WHEN ((severity * 5) + (likelihood * 3) + (regulatory_impact * 4) + (business_impact * 3)) >= 60 THEN 'P1'
      WHEN ((severity * 5) + (likelihood * 3) + (regulatory_impact * 4) + (business_impact * 3)) >= 40 THEN 'P2'
      ELSE 'P3'
    END
  ) STORED,
  mitigation_owner_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  mitigation_owner_label varchar(120),
  status varchar(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','MITIGATING','ACCEPTED','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE TABLE IF NOT EXISTS release_controls (
  control_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES release_projects(project_id) ON DELETE CASCADE,
  control_code varchar(40) NOT NULL,
  control_name varchar(180) NOT NULL,
  category varchar(80) NOT NULL,
  required boolean NOT NULL DEFAULT true,
  status varchar(24) NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (status IN ('NOT_STARTED','IN_PROGRESS','PASS','FAIL','BLOCKED','NOT_APPLICABLE')),
  evidence_link text,
  owner_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  owner_label varchar(120),
  verified_by uuid REFERENCES users(user_id) ON DELETE SET NULL,
  verified_at timestamptz,
  UNIQUE (tenant_id, project_id, control_code)
);
CREATE TABLE IF NOT EXISTS release_approvals (
  approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES release_projects(project_id) ON DELETE CASCADE,
  approver_role varchar(100) NOT NULL,
  approver_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  decision varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (decision IN ('PENDING','APPROVED','REJECTED','WAIVED')),
  comments text,
  decided_at timestamptz,
  UNIQUE (tenant_id, project_id, approver_role)
);
-- All release-governance records are tenant-isolated using the same session context
-- as the existing application RLS policies.
DO $release_rls$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'release_projects','release_epics','release_sprints','release_tickets',
    'release_milestones','release_risks','release_controls','release_approvals'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_scope ON %I USING (tenant_id = app_current_tenant_id()) WITH CHECK (tenant_id = app_current_tenant_id())',
      tbl
    );
  END LOOP;
END
$release_rls$;

-- Provision one initial release-plan workspace and milestone set per existing tenant.
WITH projects AS (
  INSERT INTO release_projects (tenant_id, project_name, release_version, status)
  SELECT tenant_id, 'JEZTECH SafetyOS Release Plan', '1.0', 'PLANNING'
  FROM tenants
  ON CONFLICT (tenant_id, project_name, release_version) DO UPDATE
    SET project_name = EXCLUDED.project_name
  RETURNING project_id, tenant_id
)
INSERT INTO release_milestones
  (tenant_id, project_id, milestone_code, milestone_name, target_sprint, exit_criteria, executive_owner, delivery_owner)
SELECT p.tenant_id, p.project_id, m.code, m.name, m.sprint, m.criteria, m.executive_owner, m.delivery_owner
FROM projects p
CROSS JOIN (VALUES
 ('M1','Security Foundation Complete','Sprint 1','MFA, RBAC, secrets management and TLS verified','CIO / Sponsor','Security Lead'),
 ('M2','Production Platform Ready','Sprint 2','Pen test complete, backups restored successfully, OWASP controls validated','CTO','Engineering Lead'),
 ('M3','Operational Safety Workflows Ready','Sprint 3','Hazard register, corrective actions and near-miss workflows operational','Head of Safety','Safety Manager'),
 ('M4','Security Operations & Monitoring Ready','Sprint 4','Monitoring, alerting, session controls and incident response playbooks live','CISO','Security Lead'),
 ('M5','Compliance & Governance Ready','Sprint 5','Compliance reporting, permit-to-work and contractor management deployed','Compliance Director','Compliance Officer'),
 ('M6','UAT Sign-Off','Sprint 5','Business, Safety, Security and Compliance approval obtained','Product Owner','QA Lead'),
 ('M7','Production Readiness Review','Sprint 5','Readiness at least 90 percent and no Critical vulnerabilities','Steering Committee','Release Manager'),
 ('M8','Go-Live','Release Day','CAB approval and deployment completed','Executive Sponsor','DevOps Lead'),
 ('M9','Hypercare Exit','+14 Days','No Sev1 incidents and SLA achieved','Product Owner','Operations Lead')
) AS m(code,name,sprint,criteria,executive_owner,delivery_owner)
ON CONFLICT (tenant_id, project_id, milestone_code) DO NOTHING;
