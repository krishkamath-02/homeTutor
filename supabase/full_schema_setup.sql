-- ============================================================================
-- HomeTutor Master Schema & Security Migration
-- File: supabase/full_schema_setup.sql
-- Description: Complete schema setup for HomeTutor:
--   1. Extensions
--   2. Tables (with idempotent ALTER TABLE for existing tables)
--   3. Indexes
--   4. Row Level Security (RLS) & Helper Security Functions
--   5. Security Policies (idempotent with DROP POLICY IF EXISTS)
--   6. Supabase Storage Bucket ('homework-files')
--   7. Secure Server-Side Test Scoring RPC function
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 2. Profiles Table (Linked to Supabase auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL CHECK (role IN ('parent', 'student')),
    avatar_url TEXT,
    invite_code TEXT UNIQUE,
    parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    subjects TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subjects TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'premium'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_test_limit INT DEFAULT 3;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_tests_count INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_test_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_children_allowed INT DEFAULT 2;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_invite_code ON public.profiles(invite_code);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON public.profiles(subscription_tier);

-- ----------------------------------------------------------------------------
-- 3. Children Entity (Enables 1-to-many child management for parents)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.children (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    grade TEXT,
    school TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 4. Parent-Children Join Table (Many-to-Many / Multiple parents per child)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parent_children (
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'parent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (parent_id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_children_parent ON public.parent_children(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_children_child ON public.parent_children(child_id);

-- ----------------------------------------------------------------------------
-- 5. Parent Invitations (Secure, expiring token-based link mechanism)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parent_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    child_id UUID REFERENCES public.children(id) ON DELETE SET NULL,
    code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '7 days'),
    used_at TIMESTAMPTZ,
    used_by_student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_invitations_code ON public.parent_invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_parent ON public.parent_invitations(parent_id);

-- ----------------------------------------------------------------------------
-- 6. Homework Entity (Independent from tests/activities)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.homework (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    child_id UUID REFERENCES public.children(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT,
    assigned_date DATE DEFAULT CURRENT_DATE,
    due_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'analyzed', 'assigned', 'completed', 'archived')),
    source_text TEXT,
    extracted_topics JSONB DEFAULT '[]'::jsonb,
    extracted_concepts JSONB DEFAULT '[]'::jsonb,
    raw_analysis JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_homework_parent ON public.homework(parent_id);
CREATE INDEX IF NOT EXISTS idx_homework_child ON public.homework(child_id);
CREATE INDEX IF NOT EXISTS idx_homework_status ON public.homework(status);

-- ----------------------------------------------------------------------------
-- 7. Homework Files (Supabase Storage reference tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.homework_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    homework_id UUID NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_homework_files_hw ON public.homework_files(homework_id);

-- ----------------------------------------------------------------------------
-- 8. Tests / Activities Table (Upgraded from prototype tests table)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    homework_id UUID REFERENCES public.homework(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    child_id UUID REFERENCES public.children(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    activity_type TEXT NOT NULL DEFAULT 'quiz' CHECK (activity_type IN ('practice', 'quiz', 'test', 'assignment', 'challenge')),
    difficulty TEXT DEFAULT 'intermediate' CHECK (difficulty IN ('basic', 'intermediate', 'advanced')),
    duration TEXT DEFAULT '15 mins',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'draft', 'assigned', 'started', 'completed')),
    due_date TIMESTAMPTZ,
    score NUMERIC,
    completed_at TIMESTAMPTZ,
    student_answers JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS homework_id UUID REFERENCES public.homework(id) ON DELETE SET NULL;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS child_id UUID REFERENCES public.children(id) ON DELETE SET NULL;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'quiz';
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'intermediate';
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '15 mins';
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS student_answers JSONB;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_tests_parent ON public.tests(parent_id);
CREATE INDEX IF NOT EXISTS idx_tests_student ON public.tests(student_id);
CREATE INDEX IF NOT EXISTS idx_tests_homework ON public.tests(homework_id);

-- ----------------------------------------------------------------------------
-- 9. Questions Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'mcq' CHECK (type IN ('mcq', 'fill_in_blank', 'short_answer', 'true_false')),
    text TEXT NOT NULL,
    prompt TEXT,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_answer_index INTEGER,
    correct_answer_text TEXT,
    explanation TEXT,
    topic TEXT,
    difficulty TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'mcq';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS correct_answer_text TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS difficulty TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_questions_test ON public.questions(test_id);

-- ----------------------------------------------------------------------------
-- 10. Test Attempts Table (Enables multiple attempts & historical scoring)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    child_id UUID REFERENCES public.children(id) ON DELETE SET NULL,
    attempt_number INTEGER DEFAULT 1,
    score NUMERIC NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_questions INTEGER NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    time_spent_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_attempts_test ON public.test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON public.test_attempts(student_id);

-- ----------------------------------------------------------------------------
-- 11. Student Progress & Topic Mastery Engine
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    mastery_score NUMERIC DEFAULT 0,
    attempts_count INTEGER DEFAULT 0,
    last_practiced_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_progress_child_topic UNIQUE (child_id, subject, topic),
    CONSTRAINT uq_progress_student_topic UNIQUE (student_id, subject, topic)
);

CREATE INDEX IF NOT EXISTS idx_progress_student ON public.student_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_progress_child ON public.student_progress(child_id);

-- ----------------------------------------------------------------------------
-- 12. Enable Row-Level Security (RLS) on All Tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 13. Helper Security Functions (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_parent_of_child(target_child_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.parent_children
        WHERE parent_id = auth.uid()
          AND child_id = target_child_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_student_linked_to_parent(target_parent_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.parent_id = target_parent_id)
    );
$$;

-- Safely retrieve parent_id without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_parent_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT parent_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 14. Row-Level Security Policies (Idempotent with DROP POLICY IF EXISTS)
-- ----------------------------------------------------------------------------

-- Profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Parents can read linked student profiles" ON public.profiles;
CREATE POLICY "Parents can read linked student profiles" ON public.profiles FOR SELECT USING (parent_id = auth.uid());

DROP POLICY IF EXISTS "Students can read linked parent profiles" ON public.profiles;
CREATE POLICY "Students can read linked parent profiles" ON public.profiles FOR SELECT USING (id = public.get_my_parent_id());

DROP POLICY IF EXISTS "Allow authenticated user to insert their own profile on signup" ON public.profiles;
CREATE POLICY "Allow authenticated user to insert their own profile on signup" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- Children
DROP POLICY IF EXISTS "Parents can view linked children" ON public.children;
CREATE POLICY "Parents can view linked children" ON public.children FOR SELECT USING (public.is_parent_of_child(id));

DROP POLICY IF EXISTS "Parents can insert children" ON public.children;
CREATE POLICY "Parents can insert children" ON public.children FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Parents can update linked children" ON public.children;
CREATE POLICY "Parents can update linked children" ON public.children FOR UPDATE USING (public.is_parent_of_child(id));

DROP POLICY IF EXISTS "Parents can delete linked children" ON public.children;
CREATE POLICY "Parents can delete linked children" ON public.children FOR DELETE USING (public.is_parent_of_child(id));

-- Parent-Children Join
DROP POLICY IF EXISTS "Parents can manage parent-children relations" ON public.parent_children;
CREATE POLICY "Parents can manage parent-children relations" ON public.parent_children FOR ALL USING (parent_id = auth.uid()) WITH CHECK (parent_id = auth.uid());

-- Parent Invitations
DROP POLICY IF EXISTS "Parents can manage their invitations" ON public.parent_invitations;
CREATE POLICY "Parents can manage their invitations" ON public.parent_invitations FOR ALL USING (parent_id = auth.uid()) WITH CHECK (parent_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated students can view valid invitations by code" ON public.parent_invitations;
CREATE POLICY "Authenticated students can view valid invitations by code" ON public.parent_invitations FOR SELECT USING (auth.uid() IS NOT NULL AND status = 'pending' AND expires_at > now());

DROP POLICY IF EXISTS "Students can accept invitation" ON public.parent_invitations;
CREATE POLICY "Students can accept invitation" ON public.parent_invitations FOR UPDATE USING (auth.uid() IS NOT NULL AND status = 'pending' AND expires_at > now()) WITH CHECK (used_by_student_id = auth.uid());

-- Homework
DROP POLICY IF EXISTS "Parents can view, create, edit, delete their homework" ON public.homework;
CREATE POLICY "Parents can view, create, edit, delete their homework" ON public.homework FOR ALL USING (parent_id = auth.uid()) WITH CHECK (parent_id = auth.uid());

DROP POLICY IF EXISTS "Students can view assigned homework" ON public.homework;
CREATE POLICY "Students can view assigned homework" ON public.homework FOR SELECT USING (
    parent_id = public.get_my_parent_id()
    OR child_id IN (
        SELECT child_id FROM public.parent_children pc
        WHERE pc.parent_id = public.get_my_parent_id()
    )
);

-- Homework Files
DROP POLICY IF EXISTS "Parents can manage homework files" ON public.homework_files;
CREATE POLICY "Parents can manage homework files" ON public.homework_files FOR ALL USING (
    EXISTS (SELECT 1 FROM public.homework h WHERE h.id = homework_files.homework_id AND h.parent_id = auth.uid())
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.homework h WHERE h.id = homework_files.homework_id AND h.parent_id = auth.uid())
);

DROP POLICY IF EXISTS "Students can view homework files" ON public.homework_files;
CREATE POLICY "Students can view homework files" ON public.homework_files FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.homework h WHERE h.id = homework_files.homework_id AND h.parent_id = public.get_my_parent_id())
);

-- Tests
DROP POLICY IF EXISTS "Parents can manage tests" ON public.tests;
CREATE POLICY "Parents can manage tests" ON public.tests FOR ALL USING (parent_id = auth.uid()) WITH CHECK (parent_id = auth.uid());

DROP POLICY IF EXISTS "Students can view assigned tests" ON public.tests;
CREATE POLICY "Students can view assigned tests" ON public.tests FOR SELECT USING (
    student_id = auth.uid() OR parent_id = public.get_my_parent_id()
);

DROP POLICY IF EXISTS "Students can update their test submission" ON public.tests;
CREATE POLICY "Students can update their test submission" ON public.tests FOR UPDATE USING (
    student_id = auth.uid() OR parent_id = public.get_my_parent_id()
) WITH CHECK (
    student_id = auth.uid() OR parent_id = public.get_my_parent_id()
);

-- Questions
DROP POLICY IF EXISTS "Parents can manage test questions" ON public.questions;
CREATE POLICY "Parents can manage test questions" ON public.questions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tests t WHERE t.id = questions.test_id AND t.parent_id = auth.uid())
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.tests t WHERE t.id = questions.test_id AND t.parent_id = auth.uid())
);

DROP POLICY IF EXISTS "Students can view test questions" ON public.questions;
CREATE POLICY "Students can view test questions" ON public.questions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.tests t
        WHERE t.id = questions.test_id
          AND (t.student_id = auth.uid() OR t.parent_id = public.get_my_parent_id())
    )
);

-- Test Attempts
DROP POLICY IF EXISTS "Students can create and view their attempts" ON public.test_attempts;
CREATE POLICY "Students can create and view their attempts" ON public.test_attempts FOR ALL USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Parents can view attempts for their tests" ON public.test_attempts;
CREATE POLICY "Parents can view attempts for their tests" ON public.test_attempts FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_attempts.test_id AND t.parent_id = auth.uid())
);

-- Student Progress
DROP POLICY IF EXISTS "Students can view own progress" ON public.student_progress;
CREATE POLICY "Students can view own progress" ON public.student_progress FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Parents can view progress of their children" ON public.student_progress;
CREATE POLICY "Parents can view progress of their children" ON public.student_progress FOR SELECT USING (
    (child_id IS NOT NULL AND public.is_parent_of_child(child_id))
    OR (student_id IS NOT NULL AND public.is_student_linked_to_parent(student_id))
);

-- ----------------------------------------------------------------------------
-- 15. Supabase Storage Bucket ('homework-files')
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'homework-files',
    'homework-files',
    false,
    20971520, -- 20MB maximum
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

DROP POLICY IF EXISTS "Parents can upload files to their folder" ON storage.objects;
CREATE POLICY "Parents can upload files to their folder" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'homework-files' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Parents can read their uploaded files" ON storage.objects;
CREATE POLICY "Parents can read their uploaded files" ON storage.objects FOR SELECT USING (
    bucket_id = 'homework-files' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Students can read files from linked parent folder" ON storage.objects;
CREATE POLICY "Students can read files from linked parent folder" ON storage.objects FOR SELECT USING (
    bucket_id = 'homework-files' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = public.get_my_parent_id()::text
);

DROP POLICY IF EXISTS "Parents can delete their own uploaded files" ON storage.objects;
CREATE POLICY "Parents can delete their own uploaded files" ON storage.objects FOR DELETE USING (
    bucket_id = 'homework-files' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ----------------------------------------------------------------------------
-- 16. Secure Server-Side Test Scoring RPC Function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_test_attempt(
    p_test_id UUID,
    p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_test RECORD;
    v_q RECORD;
    v_total_questions INT := 0;
    v_correct_count INT := 0;
    v_score NUMERIC := 0;
    v_selected_ans INT;
    v_is_correct BOOLEAN;
    v_detailed_results JSONB := '[]'::jsonb;
    v_attempt_count INT := 0;
    v_attempt_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be authenticated to submit test attempts';
    END IF;

    SELECT * INTO v_test FROM public.tests WHERE id = p_test_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Test not found';
    END IF;

    IF v_test.parent_id != v_user_id 
       AND v_test.student_id IS DISTINCT FROM v_user_id
       AND NOT public.is_student_linked_to_parent(v_test.parent_id) THEN
        RAISE EXCEPTION 'Unauthorized: You are not assigned to this test';
    END IF;

    FOR v_q IN 
        SELECT id, text, options, correct_answer_index, explanation, topic 
        FROM public.questions 
        WHERE test_id = p_test_id 
        ORDER BY order_index ASC, created_at ASC
    LOOP
        v_total_questions := v_total_questions + 1;
        v_selected_ans := NULL;

        IF p_answers ? (v_q.id)::text THEN
            v_selected_ans := (p_answers->>((v_q.id)::text))::int;
        END IF;

        v_is_correct := (v_selected_ans IS NOT NULL AND v_selected_ans = v_q.correct_answer_index);

        IF v_is_correct THEN
            v_correct_count := v_correct_count + 1;
        END IF;

        v_detailed_results := v_detailed_results || jsonb_build_object(
            'question_id', v_q.id,
            'question_text', v_q.text,
            'topic', v_q.topic,
            'selected_answer', v_selected_ans,
            'correct_answer', v_q.correct_answer_index,
            'is_correct', v_is_correct,
            'explanation', v_q.explanation
        );
    END LOOP;

    IF v_total_questions > 0 THEN
        v_score := ROUND((v_correct_count::numeric / v_total_questions::numeric) * 100);
    ELSE
        v_score := 0;
    END IF;

    SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_attempt_count
    FROM public.test_attempts
    WHERE test_id = p_test_id AND student_id = v_user_id;

    INSERT INTO public.test_attempts (
        test_id,
        student_id,
        child_id,
        attempt_number,
        score,
        total_questions,
        correct_questions,
        answers,
        completed_at
    ) VALUES (
        p_test_id,
        v_user_id,
        v_test.child_id,
        v_attempt_count,
        v_score,
        v_total_questions,
        v_correct_count,
        p_answers,
        now()
    )
    RETURNING id INTO v_attempt_id;

    UPDATE public.tests
    SET score = v_score,
        status = 'completed',
        completed_at = now(),
        student_answers = p_answers,
        student_id = COALESCE(student_id, v_user_id),
        updated_at = now()
    WHERE id = p_test_id;

    FOR v_q IN 
        SELECT DISTINCT topic 
        FROM public.questions 
        WHERE test_id = p_test_id AND topic IS NOT NULL AND topic != ''
    LOOP
        INSERT INTO public.student_progress (
            student_id,
            child_id,
            subject,
            topic,
            mastery_score,
            attempts_count,
            last_practiced_at
        ) VALUES (
            v_user_id,
            v_test.child_id,
            v_test.subject,
            v_q.topic,
            v_score,
            1,
            now()
        )
        ON CONFLICT (student_id, subject, topic)
        DO UPDATE SET
            mastery_score = ROUND((public.student_progress.mastery_score * public.student_progress.attempts_count + EXCLUDED.mastery_score) / (public.student_progress.attempts_count + 1)),
            attempts_count = public.student_progress.attempts_count + 1,
            last_practiced_at = now(),
            updated_at = now();
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'attempt_id', v_attempt_id,
        'attempt_number', v_attempt_count,
        'score', v_score,
        'total_questions', v_total_questions,
        'correct_questions', v_correct_count,
        'results', v_detailed_results
    );
END;
$$;
