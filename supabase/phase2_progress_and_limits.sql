-- ============================================================================
-- Phase 2 & 3: Progress Analytics, RLS Permissions & Child Limit Enforcement
-- File: supabase/phase2_progress_and_limits.sql
-- ============================================================================

-- 1. Helper function for parent to verify student relationship without RLS recursion
CREATE OR REPLACE FUNCTION public.is_my_student(target_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = target_student_id AND parent_id = auth.uid()
    );
$$;

-- 2. Fix Parents can view progress policy
DROP POLICY IF EXISTS "Parents can view progress of their children" ON public.student_progress;
CREATE POLICY "Parents can view progress of their children" ON public.student_progress 
FOR SELECT USING (
    (child_id IS NOT NULL AND public.is_parent_of_child(child_id))
    OR (student_id IS NOT NULL AND public.is_my_student(student_id))
    OR (student_id = auth.uid())
);

-- 3. Enhanced can_add_child checking both parent_children and profiles.parent_id
CREATE OR REPLACE FUNCTION public.can_add_child(p_parent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_tier TEXT;
    v_max INT;
    v_current_count INT;
BEGIN
    SELECT 
        COALESCE(subscription_tier, 'free'),
        COALESCE(max_children_allowed, 2)
    INTO v_tier, v_max
    FROM public.profiles
    WHERE id = p_parent_id;

    -- Count distinct children linked through either method
    SELECT GREATEST(
        (SELECT COUNT(*) FROM public.parent_children WHERE parent_id = p_parent_id),
        (SELECT COUNT(*) FROM public.profiles WHERE parent_id = p_parent_id)
    ) INTO v_current_count;

    IF v_tier = 'free' AND v_current_count >= v_max THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current_count', v_current_count,
            'max_allowed', v_max,
            'tier', v_tier,
            'message', 'Free plan is limited to ' || v_max || ' children. Upgrade to Pro for 3 children, or Family Premium for unlimited.'
        );
    ELSIF v_tier = 'pro' AND v_current_count >= 3 THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current_count', v_current_count,
            'max_allowed', 3,
            'tier', v_tier,
            'message', 'Pro plan is limited to 3 children. Upgrade to Family Premium for unlimited children.'
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'current_count', v_current_count,
        'max_allowed', v_max,
        'tier', v_tier
    );
END;
$$;

-- 4. Secure RPC function for linking a student to a parent by invite code
CREATE OR REPLACE FUNCTION public.link_student_to_parent(p_invite_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student_id UUID;
    v_parent RECORD;
    v_can_add JSONB;
BEGIN
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized. Please log in.');
    END IF;

    -- Find parent by invite code
    SELECT id, name, subscription_tier, max_children_allowed 
    INTO v_parent
    FROM public.profiles
    WHERE UPPER(invite_code) = UPPER(TRIM(p_invite_code)) AND role = 'parent';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid invite code. Please check with your parent.');
    END IF;

    -- Check if student is already linked to this parent
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_student_id AND parent_id = v_parent.id) THEN
        RETURN jsonb_build_object('success', true, 'parent_name', v_parent.name, 'already_linked', true);
    END IF;

    -- Check if parent has reached child profile limit
    v_can_add := public.can_add_child(v_parent.id);
    IF (v_can_add->>'allowed')::boolean = false THEN
        RETURN jsonb_build_object(
            'success', false, 
            'limit_reached', true,
            'message', v_can_add->>'message'
        );
    END IF;

    -- Link student to parent
    UPDATE public.profiles
    SET parent_id = v_parent.id,
        updated_at = now()
    WHERE id = v_student_id;

    RETURN jsonb_build_object(
        'success', true, 
        'parent_id', v_parent.id,
        'parent_name', v_parent.name
    );
END;
$$;
