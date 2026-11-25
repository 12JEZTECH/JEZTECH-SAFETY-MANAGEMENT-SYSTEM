ALTER TABLE tenants ADD COLUMN institution_type text NOT NULL DEFAULT 'GENERAL' CHECK(institution_type IN ('GENERAL','SCHOOL','TVET','UNIVERSITY','HOSPITAL','CLINIC','FACTORY','CONSTRUCTION','GOVERNMENT','HOSPITALITY','AGRICULTURE','WAREHOUSE','NGO','RELIGIOUS','COMMERCIAL','OTHER'));
CREATE TABLE institution_report_settings (
 tenant_id uuid PRIMARY KEY REFERENCES tenants(tenant_id),
 report_heading text NOT NULL DEFAULT 'Safety and Compliance Report',
 prepared_by_label text NOT NULL DEFAULT 'Prepared by',
 approved_by_label text NOT NULL DEFAULT 'Approved by',
 paper_size text NOT NULL DEFAULT 'A4' CHECK(paper_size IN ('A4','A3','LETTER')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE institution_report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_report_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON institution_report_settings USING(tenant_id=app_current_tenant_id()) WITH CHECK(tenant_id=app_current_tenant_id());
