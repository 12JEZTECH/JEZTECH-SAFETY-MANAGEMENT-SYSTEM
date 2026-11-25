ALTER TABLE tenants ADD COLUMN access_expires_at timestamptz;
ALTER TABLE tenants ADD COLUMN trial_started_at timestamptz;
