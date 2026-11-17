-- ============================================================================
-- Fix: RLS Infinite Recursion on Profiles and Dependent Tables
-- File: supabase/fix_rls_recursion.sql
-- Run this in the Supabase SQL Editor to resolve the HTTP 500 error immediately.
-- ============================================================================

-- 1. Helper function to safely fetch the parent ID without triggering RLS
CREATE OR REPLACE FUNCTION public.get_my_parent_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT parent_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Fix Profiles policy (replaces recursive SELECT with SECURITY DEFINER function)
DROP POLICY IF EXISTS "Students can read linked parent profiles" ON public.profiles;
CREATE POLICY "Students can read linked parent profiles"
    ON public.profiles FOR SELECT
    USING (id = public.get_my_parent_id());

-- 3. Fix Homework policies
DROP POLICY IF EXISTS "Students can view assigned homework" ON public.homework;
CREATE POLICY "Students can view assigned homework"
    ON public.homework FOR SELECT
    USING (
        parent_id = public.get_my_parent_id()
        OR child_id IN (
            SELECT child_id FROM public.parent_children pc
            WHERE pc.parent_id = public.get_my_parent_id()
        )
    );

-- 4. Fix Homework Files policies
DROP POLICY IF EXISTS "Students can view homework files" ON public.homework_files;
CREATE POLICY "Students can view homework files"
    ON public.homework_files FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.homework h
            WHERE h.id = homework_files.homework_id
              AND h.parent_id = public.get_my_parent_id()
        )
    );

-- 5. Fix Tests policies
DROP POLICY IF EXISTS "Students can view assigned tests" ON public.tests;
CREATE POLICY "Students can view assigned tests"
    ON public.tests FOR SELECT
    USING (
        student_id = auth.uid() OR parent_id = public.get_my_parent_id()
    );

DROP POLICY IF EXISTS "Students can update their test submission" ON public.tests;
CREATE POLICY "Students can update their test submission"
    ON public.tests FOR UPDATE
    USING (
        student_id = auth.uid() OR parent_id = public.get_my_parent_id()
    )
    WITH CHECK (
        student_id = auth.uid() OR parent_id = public.get_my_parent_id()
    );

-- 6. Fix Questions policies
DROP POLICY IF EXISTS "Students can view test questions" ON public.questions;
CREATE POLICY "Students can view test questions"
    ON public.questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = questions.test_id
              AND (t.student_id = auth.uid() OR t.parent_id = public.get_my_parent_id())
        )
    );

-- 7. Fix Storage policies
DROP POLICY IF EXISTS "Students can read files from linked parent folder" ON storage.objects;
CREATE POLICY "Students can read files from linked parent folder"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'homework-files'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.get_my_parent_id()::text
    );
