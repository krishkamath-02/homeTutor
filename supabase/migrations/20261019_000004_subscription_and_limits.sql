-- ============================================================================
-- HomeTutor Subscription & Freemium Tier Management
-- Migration: 20261019_000004_subscription_and_limits.sql
-- Description: Adds subscription fields, daily generation limits, and child profile limits.
-- ============================================================================

-- 1. Add subscription columns to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'premium')),
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing')),
ADD COLUMN IF NOT EXISTS daily_test_limit INT DEFAULT 3,
ADD COLUMN IF NOT EXISTS daily_tests_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_test_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS max_children_allowed INT DEFAULT 2,
ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- 2. Index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON public.profiles(subscription_tier);

-- 3. Function to check if a parent is allowed to add another child
--    Free tier: max 2 children. Pro/Premium: unlimited (or tier limit).
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

    SELECT COUNT(*) INTO v_current_count
    FROM public.parent_children
    WHERE parent_id = p_parent_id;

    IF v_tier = 'free' AND v_current_count >= v_max THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current_count', v_current_count,
            'max_allowed', v_max,
            'tier', v_tier,
            'message', 'Free plan is limited to ' || v_max || ' children. Upgrade to Pro or Family Premium to add more children.'
        );
    ELSIF v_tier = 'pro' AND v_current_count >= v_max THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current_count', v_current_count,
            'max_allowed', v_max,
            'tier', v_tier,
            'message', 'Pro plan is limited to ' || v_max || ' children. Upgrade to Family Premium for unlimited children.'
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

-- 4. Function to check if a user is allowed to generate a test today
--    Free tier: 3 tests per day. Pro/Premium: unlimited.
--    Automatically resets daily count if date has changed.
CREATE OR REPLACE FUNCTION public.check_and_record_test_generation(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier TEXT;
    v_limit INT;
    v_count INT;
    v_last_date DATE;
    v_today DATE := CURRENT_DATE;
BEGIN
    SELECT 
        COALESCE(subscription_tier, 'free'),
        COALESCE(daily_test_limit, 3),
        COALESCE(daily_tests_count, 0),
        COALESCE(last_test_date, v_today)
    INTO v_tier, v_limit, v_count, v_last_date
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE; -- Lock row for safe concurrency

    -- Reset counter if it's a new day
    IF v_last_date < v_today THEN
        v_count := 0;
        v_last_date := v_today;
    END IF;

    -- Check if free tier limit is reached
    IF v_tier = 'free' AND v_count >= v_limit THEN
        -- Update the reset date even if blocked
        UPDATE public.profiles
        SET last_test_date = v_today,
            daily_tests_count = v_count
        WHERE id = p_user_id;

        RETURN jsonb_build_object(
            'allowed', false,
            'current_count', v_count,
            'daily_limit', v_limit,
            'remaining', 0,
            'tier', v_tier,
            'message', 'You have reached your daily free limit of ' || v_limit || ' tests. Upgrade to Premium for unlimited test generations!'
        );
    END IF;

    -- Increment count and record today's date
    v_count := v_count + 1;
    UPDATE public.profiles
    SET daily_tests_count = v_count,
        last_test_date = v_today
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'allowed', true,
        'current_count', v_count,
        'daily_limit', v_limit,
        'remaining', GREATEST(v_limit - v_count, 0),
        'tier', v_tier
    );
END;
$$;
