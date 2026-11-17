-- ============================================================================
-- Phase 3 Migration: The Paper-to-Digital Bridge (Handwriting & Step Evaluation)
-- ============================================================================

-- 1. Add rough work storage and step evaluation columns to tests table
ALTER TABLE public.tests
ADD COLUMN IF NOT EXISTS rough_work_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rough_work_evaluation JSONB DEFAULT NULL;

-- 2. Add rough work fields to test_attempts table
ALTER TABLE public.test_attempts
ADD COLUMN IF NOT EXISTS rough_work_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rough_work_evaluation JSONB DEFAULT NULL;

-- 3. Add requires_working_space to questions table for printable worksheets
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS requires_working_space BOOLEAN DEFAULT true;

-- 4. Create storage bucket for student rough work if not already present
INSERT INTO storage.buckets (id, name, public)
VALUES ('rough-work', 'rough-work', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies for rough-work bucket
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Public Access for rough-work images'
    ) THEN
        CREATE POLICY "Public Access for rough-work images"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'rough-work');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload rough-work'
    ) THEN
        CREATE POLICY "Authenticated users can upload rough-work"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'rough-work');
    END IF;
END $$;
