-- ============================================================================
-- Phase 2: Diagnostic Pedagogy, Misconception Engine & Curriculum Alignment
-- File: supabase/phase2_diagnostic_pedagogy.sql
-- ============================================================================

-- 1. Add curriculum and grade level to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS curriculum_board TEXT DEFAULT 'CBSE',
ADD COLUMN IF NOT EXISTS grade_level INT DEFAULT 5;

-- 2. Add diagnostic distractor analysis and Socratic hint columns to questions
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS distractor_analysis JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS socratic_hint TEXT,
ADD COLUMN IF NOT EXISTS sub_topic TEXT;

-- 3. Add hints_used tracking to test_attempts
ALTER TABLE public.test_attempts
ADD COLUMN IF NOT EXISTS hints_used JSONB DEFAULT '{}'::jsonb;
