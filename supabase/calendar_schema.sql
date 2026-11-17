-- ============================================================================
-- Calendar & Study Schedule Schema
-- File: supabase/calendar_schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    child_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('exam', 'test_prep', 'study_block')),
    subject TEXT NOT NULL,
    date DATE NOT NULL,
    start_time TEXT, -- '09:00'
    end_time TEXT,   -- '10:30'
    description TEXT,
    is_completed BOOLEAN DEFAULT false,
    test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_parent_id ON public.calendar_events(parent_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_child_id ON public.calendar_events(child_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON public.calendar_events(date);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Parents can read, insert, update, and delete their own calendar events
DROP POLICY IF EXISTS "Parents full access to own calendar events" ON public.calendar_events;
CREATE POLICY "Parents full access to own calendar events" ON public.calendar_events
    FOR ALL
    USING (parent_id = auth.uid())
    WITH CHECK (parent_id = auth.uid());

-- Students can read calendar events assigned to them or their parent
DROP POLICY IF EXISTS "Students can view assigned calendar events" ON public.calendar_events;
CREATE POLICY "Students can view assigned calendar events" ON public.calendar_events
    FOR SELECT
    USING (
        child_id = auth.uid() OR 
        parent_id IN (SELECT parent_id FROM public.profiles WHERE id = auth.uid())
    );

