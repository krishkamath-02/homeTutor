-- ============================================================================
-- HomeTutor Database Schema Migration
-- Migration: 20261013_000001_initial_schema.sql
-- Description: Establishes normalized entities for accounts, children,
--              homework files, activities/tests, questions, and attempts.
-- ============================================================================

-- Enable pgcrypto / uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Profiles Table (Linked to Supabase auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL CHECK (role IN ('parent', 'student')),
    avatar_url TEXT,
    invite_code TEXT UNIQUE,
    parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Maintained for legacy linking fallback
    subjects TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
);

-- Ensure all columns exist if upgrading an existing prototype profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subjects TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- Index for profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_invite_code ON public.profiles(invite_code);

-- ----------------------------------------------------------------------------
-- 2. Children Entity (Enables 1-to-many child management for parents)
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
-- 3. Parent-Children Join Table (Many-to-Many / Multiple parents per child)
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
-- 4. Parent Invitations (Secure, expiring token-based link mechanism)
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
-- 5. Homework Entity (Independent from tests/activities)
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
-- 6. Homework Files (Supabase Storage reference tracking)
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
-- 7. Tests / Activities Table (Upgraded from prototype tests table)
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

-- Ensure all columns exist if upgrading an existing prototype tests table
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
-- 8. Questions Table
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

-- Ensure all columns exist if upgrading an existing prototype questions table
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'mcq';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS correct_answer_text TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS difficulty TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_questions_test ON public.questions(test_id);

-- ----------------------------------------------------------------------------
-- 9. Test Attempts Table (Enables multiple attempts & historical scoring)
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
-- 10. Student Progress & Topic Mastery Engine
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
