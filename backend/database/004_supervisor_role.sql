-- Extend stored role vocabulary without renaming existing production roles.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin','admin','safety_department','supervisor','auditor_officer','user','wall_display_kiosk'));
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_requested_role_check;
ALTER TABLE users ADD CONSTRAINT users_requested_role_check CHECK (requested_role IN ('user','supervisor','safety_department','auditor_officer','admin','super_admin','wall_display_kiosk'));
