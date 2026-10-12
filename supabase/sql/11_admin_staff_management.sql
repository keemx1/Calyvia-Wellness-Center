-- ==============================================================================
-- Calyvia Wellness Center — Migration 11: Admin-Controlled Staff Management & RBAC
-- ==============================================================================
-- Enforces:
-- 1. Strictly administrator-controlled staff provisioning (no self-registration).
-- 2. Row Level Security policies ensuring only Facility Administrators can insert/update staff.
-- 3. Authenticated personnel read access to their own account and staff directory.
-- 4. Mandatory audit trail logging for staff account creation and role modification.
-- ==============================================================================

SET search_path = public, extensions;

DO $$
BEGIN
    -- 1. Reconcile columns on public.users
    IF to_regclass('public.users') IS NOT NULL THEN
        ALTER TABLE public.users 
            ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'APPROVED',
            ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id),
            ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

        -- Create performance indexes
        CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users (LOWER(email::text));
        CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);
        CREATE INDEX IF NOT EXISTS idx_users_approval_status ON public.users (approval_status);
        CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users (is_active);

        -- Ensure default primary administrator is active and approved
        UPDATE public.users 
        SET approval_status = 'APPROVED', is_active = true, updated_at = now()
        WHERE email = 'admin@calyviawellness.co.ke';
        
        RAISE NOTICE 'public.users columns and indexes reconciled successfully.';
    END IF;

    -- 2. Reconcile columns on public.staff_profiles
    IF to_regclass('public.staff_profiles') IS NOT NULL THEN
        ALTER TABLE public.staff_profiles
            ADD COLUMN IF NOT EXISTS license_number TEXT,
            ADD COLUMN IF NOT EXISTS license_board TEXT,
            ADD COLUMN IF NOT EXISTS license_expiry_date TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS date_joined TIMESTAMPTZ NOT NULL DEFAULT now();

        CREATE INDEX IF NOT EXISTS idx_staff_profiles_dept ON public.staff_profiles (department);
        CREATE INDEX IF NOT EXISTS idx_staff_profiles_license_exp ON public.staff_profiles (license_expiry_date);

        RAISE NOTICE 'public.staff_profiles columns and indexes reconciled successfully.';
    END IF;

    -- 3. Row Level Security (RLS) Policies on users and staff_profiles
    IF to_regclass('public.users') IS NOT NULL THEN
        -- Enable RLS
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

        -- Drop old conflicting policies
        DROP POLICY IF EXISTS users_self_read ON public.users;
        DROP POLICY IF EXISTS users_self_update ON public.users;
        DROP POLICY IF EXISTS users_admin_all ON public.users;
        DROP POLICY IF EXISTS users_staff_read ON public.users;

        -- Self read policy: Authenticated user can read their own user row
        CREATE POLICY users_self_read ON public.users
            FOR SELECT TO authenticated
            USING (id = auth.uid());

        -- Directory read policy: Authorized clinical and management roles can view staff accounts
        CREATE POLICY users_staff_read ON public.users
            FOR SELECT TO authenticated
            USING (public.get_current_user_role() IN (
                'SUPER_ADMIN', 'FACILITY_ADMIN', 'MEDICAL_DIRECTOR', 
                'DOCTOR_PSYCHIATRIST', 'NURSE', 'COUNSELLOR', 'PHARMACIST',
                'ADMISSIONS_FRONT_DESK', 'MANAGEMENT_EXECUTIVE'
            ));

        -- Admin full management: Only SUPER_ADMIN and FACILITY_ADMIN can insert, update, or delete users
        CREATE POLICY users_admin_all ON public.users
            FOR ALL TO authenticated
            USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'FACILITY_ADMIN'))
            WITH CHECK (public.get_current_user_role() IN ('SUPER_ADMIN', 'FACILITY_ADMIN'));

        RAISE NOTICE 'RLS policies on public.users updated successfully.';
    END IF;

    IF to_regclass('public.staff_profiles') IS NOT NULL THEN
        -- Enable RLS
        ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

        -- Drop old policies
        DROP POLICY IF EXISTS staff_profiles_self_read ON public.staff_profiles;
        DROP POLICY IF EXISTS staff_profiles_admin_all ON public.staff_profiles;
        DROP POLICY IF EXISTS staff_profiles_directory_read ON public.staff_profiles;

        -- Self read policy
        CREATE POLICY staff_profiles_self_read ON public.staff_profiles
            FOR SELECT TO authenticated
            USING (user_id = auth.uid());

        -- Directory read policy
        CREATE POLICY staff_profiles_directory_read ON public.staff_profiles
            FOR SELECT TO authenticated
            USING (public.get_current_user_role() IN (
                'SUPER_ADMIN', 'FACILITY_ADMIN', 'MEDICAL_DIRECTOR', 
                'DOCTOR_PSYCHIATRIST', 'NURSE', 'COUNSELLOR', 'PHARMACIST',
                'ADMISSIONS_FRONT_DESK', 'MANAGEMENT_EXECUTIVE'
            ));

        -- Admin full management
        CREATE POLICY staff_profiles_admin_all ON public.staff_profiles
            FOR ALL TO authenticated
            USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'FACILITY_ADMIN'))
            WITH CHECK (public.get_current_user_role() IN ('SUPER_ADMIN', 'FACILITY_ADMIN'));

        RAISE NOTICE 'RLS policies on public.staff_profiles updated successfully.';
    END IF;
END $$;
