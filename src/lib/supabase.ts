import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// Database Entities & Types
// ============================================================================

export type DatabaseProfile = {
    id: string;
    name: string;
    email?: string;
    role: 'parent' | 'student';
    avatar_url: string | null;
    invite_code?: string;
    parent_id?: string | null;
    subjects?: string[];
    subscription_tier?: 'free' | 'pro' | 'premium';
    subscription_status?: string;
    daily_test_limit?: number;
    daily_tests_count?: number;
    max_children_allowed?: number;
    curriculum_board?: string;
    grade_level?: number;
    created_at: string;
    updated_at?: string;
};

export type DatabaseChild = {
    id: string;
    name: string;
    grade?: string | null;
    school?: string | null;
    avatar_url?: string | null;
    created_at: string;
    updated_at?: string;
};

export type DatabaseParentChild = {
    parent_id: string;
    child_id: string;
    relationship: string;
    created_at: string;
};

export type DatabaseParentInvitation = {
    id: string;
    parent_id: string;
    child_id?: string | null;
    code: string;
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
    expires_at: string;
    used_at?: string | null;
    used_by_student_id?: string | null;
    created_at: string;
};

export type DatabaseHomework = {
    id: string;
    parent_id: string;
    child_id?: string | null;
    title: string;
    subject: string;
    description?: string | null;
    assigned_date?: string | null;
    due_date?: string | null;
    status: 'pending' | 'processing' | 'analyzed' | 'assigned' | 'completed' | 'archived';
    source_text?: string | null;
    extracted_topics?: string[];
    extracted_concepts?: string[];
    raw_analysis?: Record<string, any>;
    created_at: string;
    updated_at?: string;
};

export type DatabaseHomeworkFile = {
    id: string;
    homework_id: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
    file_size: number;
    created_at: string;
};

export interface StepMarkDetail {
    questionNumber: number;
    questionId?: string;
    methodMark: number;
    calculationMark: number;
    finalMark: number;
    maxMarks: number;
    transcribedSteps?: string[];
    stepFeedback: string;
    identifiedErrorType?: string | null;
}

export interface RoughWorkEvaluation {
    transcribedSummary: string;
    overallFeedback: string;
    accuracyScore?: number;
    stepMarks: Record<string, StepMarkDetail>;
    evaluatedAt?: string;
}

export type DatabaseTest = {
    id: string;
    homework_id?: string | null;
    title: string;
    subject: string;
    activity_type?: 'practice' | 'quiz' | 'test' | 'assignment' | 'challenge';
    difficulty?: 'basic' | 'intermediate' | 'advanced';
    duration: string;
    status: 'pending' | 'draft' | 'assigned' | 'started' | 'completed';
    score: number | null;
    due_date: string | null;
    completed_at: string | null;
    student_answers: Record<string, number> | null;
    parent_id: string;
    student_id: string | null;
    child_id?: string | null;
    rough_work_url?: string | null;
    rough_work_evaluation?: RoughWorkEvaluation | null;
    created_at: string;
    updated_at?: string;
};

export type DatabaseQuestion = {
    id: string;
    test_id: string;
    type?: 'mcq' | 'fill_in_blank' | 'short_answer' | 'true_false';
    text: string;
    prompt?: string;
    options: string[];
    correct_answer_index: number;
    correct_answer_text?: string;
    explanation?: string;
    topic?: string;
    difficulty?: string;
    distractor_analysis?: Record<string, string>;
    socratic_hint?: string;
    requires_working_space?: boolean;
    order_index?: number;
    created_at: string;
};

export type DatabaseTestAttempt = {
    id: string;
    test_id: string;
    student_id?: string | null;
    child_id?: string | null;
    attempt_number: number;
    score: number;
    total_questions: number;
    correct_questions: number;
    answers: Record<string, any>;
    rough_work_url?: string | null;
    rough_work_evaluation?: RoughWorkEvaluation | null;
    started_at?: string;
    completed_at: string;
    time_spent_seconds?: number;
    created_at: string;
};

export type DatabaseStudentProgress = {
    id: string;
    child_id?: string | null;
    student_id?: string | null;
    subject: string;
    topic: string;
    mastery_score: number;
    attempts_count: number;
    last_practiced_at?: string;
    created_at: string;
    updated_at: string;
};
