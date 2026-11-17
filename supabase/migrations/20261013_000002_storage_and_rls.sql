-- ============================================================================
-- HomeTutor Storage & Row-Level Security (RLS) Migration
-- Migration: 20261013_000002_storage_and_rls.sql
-- Description: Enforces multi-tenant data isolation between parents and children.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enable RLS on All Tables
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
-- 2. Helper Security Functions (SECURITY DEFINER)
-- ----------------------------------------------------------------------------

-- Check if current authenticated user is parent of a given child
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

-- Check if current authenticated user is linked student of a given parent
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

-- ----------------------------------------------------------------------------
-- 3. Profiles Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Parents can read linked student profiles"
    ON public.profiles FOR SELECT
    USING (parent_id = auth.uid());

CREATE POLICY "Students can read linked parent profiles"
    ON public.profiles FOR SELECT
    USING (id = (SELECT parent_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Allow authenticated user to insert their own profile on signup"
    ON public.profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. Children Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Parents can view linked children"
    ON public.children FOR SELECT
    USING (public.is_parent_of_child(id));

CREATE POLICY "Parents can insert children"
    ON public.children FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Parents can update linked children"
    ON public.children FOR UPDATE
    USING (public.is_parent_of_child(id));

CREATE POLICY "Parents can delete linked children"
    ON public.children FOR DELETE
    USING (public.is_parent_of_child(id));

-- ----------------------------------------------------------------------------
-- 5. Parent-Children Join Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Parents can manage parent-children relations"
    ON public.parent_children FOR ALL
    USING (parent_id = auth.uid())
    WITH CHECK (parent_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 6. Parent Invitations Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Parents can manage their invitations"
    ON public.parent_invitations FOR ALL
    USING (parent_id = auth.uid())
    WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Authenticated students can view valid invitations by code"
    ON public.parent_invitations FOR SELECT
    USING (auth.uid() IS NOT NULL AND status = 'pending' AND expires_at > now());

CREATE POLICY "Students can accept invitation"
    ON public.parent_invitations FOR UPDATE
    USING (auth.uid() IS NOT NULL AND status = 'pending' AND expires_at > now())
    WITH CHECK (used_by_student_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 7. Homework Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Parents can view, create, edit, delete their homework"
    ON public.homework FOR ALL
    USING (parent_id = auth.uid())
    WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Students can view assigned homework"
    ON public.homework FOR SELECT
    USING (
        parent_id = (SELECT parent_id FROM public.profiles WHERE id = auth.uid())
        OR child_id IN (
            SELECT child_id FROM public.parent_children pc
            JOIN public.profiles p ON p.parent_id = pc.parent_id
            WHERE p.id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- 8. Homework Files Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Parents can manage homework files"
    ON public.homework_files FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.homework h
            WHERE h.id = homework_files.homework_id
              AND h.parent_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.homework h
            WHERE h.id = homework_files.homework_id
              AND h.parent_id = auth.uid()
        )
    );

CREATE POLICY "Students can view homework files"
    ON public.homework_files FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.homework h
            WHERE h.id = homework_files.homework_id
              AND (
                h.parent_id = (SELECT parent_id FROM public.profiles WHERE id = auth.uid())
              )
        )
    );

-- ----------------------------------------------------------------------------
-- 9. Tests / Activities Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Parents can manage tests"
    ON public.tests FOR ALL
    USING (parent_id = auth.uid())
    WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Students can view assigned tests"
    ON public.tests FOR SELECT
    USING (
        student_id = auth.uid()
        OR parent_id = (SELECT parent_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Students can update their test submission"
    ON public.tests FOR UPDATE
    USING (
        student_id = auth.uid()
        OR parent_id = (SELECT parent_id FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        student_id = auth.uid()
        OR parent_id = (SELECT parent_id FROM public.profiles WHERE id = auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 10. Questions Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Parents can manage test questions"
    ON public.questions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = questions.test_id
              AND t.parent_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = questions.test_id
              AND t.parent_id = auth.uid()
        )
    );

CREATE POLICY "Students can view test questions"
    ON public.questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = questions.test_id
              AND (
                  t.student_id = auth.uid()
                  OR t.parent_id = (SELECT parent_id FROM public.profiles WHERE id = auth.uid())
              )
        )
    );

-- ----------------------------------------------------------------------------
-- 11. Test Attempts Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Students can create and view their attempts"
    ON public.test_attempts FOR ALL
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "Parents can view attempts for their tests"
    ON public.test_attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = test_attempts.test_id
              AND t.parent_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- 12. Student Progress Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Students can view own progress"
    ON public.student_progress FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "Parents can view progress of their children"
    ON public.student_progress FOR SELECT
    USING (
        (child_id IS NOT NULL AND public.is_parent_of_child(child_id))
        OR (student_id IS NOT NULL AND public.is_student_linked_to_parent(student_id))
    );

-- ----------------------------------------------------------------------------
-- 13. Supabase Storage Bucket Configuration
-- ----------------------------------------------------------------------------
-- Create private 'homework-files' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'homework-files',
    'homework-files',
    false,
    20971520, -- 20MB maximum file size
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

-- Storage Policies for 'homework-files' bucket
CREATE POLICY "Parents can upload files to their folder"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'homework-files'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Parents can read their uploaded files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'homework-files'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Students can read files from linked parent folder"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'homework-files'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = (SELECT parent_id::text FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Parents can delete their own uploaded files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'homework-files'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
