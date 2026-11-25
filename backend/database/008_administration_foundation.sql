CREATE TABLE password_reset_tokens (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_user_idx ON password_reset_tokens(user_id);
CREATE TABLE subscription_plans (
 plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE NOT NULL,
 monthly_price numeric(14,2) NOT NULL CHECK(monthly_price>=0), currency char(3) NOT NULL DEFAULT 'KES',
 trial_days integer NOT NULL DEFAULT 30 CHECK(trial_days BETWEEN 0 AND 365),
 active boolean NOT NULL DEFAULT true, features jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE client_subscriptions (
 subscription_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
 plan_id uuid NOT NULL REFERENCES subscription_plans(plan_id), status text NOT NULL CHECK(status IN ('TRIAL','ACTIVE','EXPIRED','SUSPENDED','CANCELLED')),
 starts_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 agreed_price numeric(14,2) NOT NULL CHECK(agreed_price>=0), currency char(3) NOT NULL DEFAULT 'KES',
 CHECK(expires_at>starts_at), UNIQUE(tenant_id,subscription_id)
);
CREATE TABLE subscription_invoices (
 invoice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
 subscription_id uuid NOT NULL, amount numeric(14,2) NOT NULL CHECK(amount>=0), currency char(3) NOT NULL DEFAULT 'KES',
 due_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,invoice_id), FOREIGN KEY(tenant_id,subscription_id) REFERENCES client_subscriptions(tenant_id,subscription_id)
);
CREATE TABLE subscription_payments (
 payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
 invoice_id uuid NOT NULL, amount numeric(14,2) NOT NULL CHECK(amount>0), currency char(3) NOT NULL DEFAULT 'KES',
 provider text NOT NULL, provider_reference text NOT NULL, status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','VERIFIED','REJECTED','REVERSED')),
 verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,provider_reference),
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES subscription_invoices(tenant_id,invoice_id)
);
CREATE TABLE backup_runs (
 backup_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), destination text NOT NULL,
 status text NOT NULL CHECK(status IN ('RUNNING','SUCCEEDED','FAILED')),
 started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, checksum text, size_bytes bigint CHECK(size_bytes>=0),
 restore_verified_at timestamptz
);
CREATE TABLE client_support_tickets (
 ticket_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
 requester_id uuid NOT NULL REFERENCES users(user_id), subject text NOT NULL, message text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('SUPPORT','CONSULTATION')), status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','CLOSED')),
 created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['client_subscriptions','subscription_invoices','subscription_payments','client_support_tickets'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_scope ON %I USING (tenant_id=app_current_tenant_id()) WITH CHECK (tenant_id=app_current_tenant_id())',t);
 END LOOP;
END $$;
