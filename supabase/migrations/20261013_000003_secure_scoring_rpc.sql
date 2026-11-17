-- ============================================================================
-- Secure Server-Side Test Scoring RPC Migration
-- Migration: 20261013_000003_secure_scoring_rpc.sql
-- Description: Calculates test score server-side, prevents student score tampering,
--              stores test attempt, and returns verified evaluation.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_test_attempt(
    p_test_id UUID,
    p_answers JSONB -- e.g. {"q-uuid-1": 2, "q-uuid-2": 0}
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

    -- Fetch the test and verify existence & authorization
    SELECT * INTO v_test FROM public.tests WHERE id = p_test_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Test not found';
    END IF;

    -- Verify user is the student or linked parent
    IF v_test.parent_id != v_user_id 
       AND v_test.student_id IS DISTINCT FROM v_user_id
       AND NOT public.is_student_linked_to_parent(v_test.parent_id) THEN
        RAISE EXCEPTION 'Unauthorized: You are not assigned to this test';
    END IF;

    -- Iterate over each question to evaluate answers server-side
    FOR v_q IN 
        SELECT id, text, options, correct_answer_index, explanation, topic 
        FROM public.questions 
        WHERE test_id = p_test_id 
        ORDER BY order_index ASC, created_at ASC
    LOOP
        v_total_questions := v_total_questions + 1;
        v_selected_ans := NULL;

        -- Extract answer given for this question ID
        IF p_answers ? (v_q.id)::text THEN
            v_selected_ans := (p_answers->>((v_q.id)::text))::int;
        END IF;

        v_is_correct := (v_selected_ans IS NOT NULL AND v_selected_ans = v_q.correct_answer_index);
        IF v_is_correct THEN
            v_correct_count := v_correct_count + 1;
        END IF;

        -- Build detailed evaluation payload with explanation
        v_detailed_results := v_detailed_results || jsonb_build_object(
            'question_id', v_q.id,
            'selected_index', v_selected_ans,
            'correct_index', v_q.correct_answer_index,
            'is_correct', v_is_correct,
            'explanation', v_q.explanation
        );
    END LOOP;

    -- Calculate verified percentage score
    IF v_total_questions > 0 THEN
        v_score := ROUND((v_correct_count::numeric / v_total_questions::numeric) * 100);
    ELSE
        v_score := 0;
    END IF;

    -- Count previous attempts
    SELECT COUNT(*) INTO v_attempt_count FROM public.test_attempts WHERE test_id = p_test_id;

    -- Insert attempt record
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
        v_attempt_count + 1,
        v_score,
        v_total_questions,
        v_correct_count,
        p_answers,
        now()
    ) RETURNING id INTO v_attempt_id;

    -- Update test status and score
    UPDATE public.tests
    SET status = 'completed',
        score = v_score,
        completed_at = now(),
        student_answers = p_answers,
        updated_at = now()
    WHERE id = p_test_id;

    -- Update student topic progress if questions have topics
    FOR v_q IN 
        SELECT DISTINCT topic FROM public.questions 
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
        ON CONFLICT (student_id, subject, topic) DO UPDATE SET
            mastery_score = ROUND((public.student_progress.mastery_score * public.student_progress.attempts_count + v_score) / (public.student_progress.attempts_count + 1)),
            attempts_count = public.student_progress.attempts_count + 1,
            last_practiced_at = now(),
            updated_at = now();
    END LOOP;

    -- Return comprehensive result to caller
    RETURN jsonb_build_object(
        'success', true,
        'attempt_id', v_attempt_id,
        'score', v_score,
        'total_questions', v_total_questions,
        'correct_questions', v_correct_count,
        'completed_at', now(),
        'results', v_detailed_results
    );
END;
$$;
