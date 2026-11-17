import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DatabaseTest, DatabaseQuestion, RoughWorkEvaluation } from '../lib/supabase';
import useAuthStore from './authStore';
import { generateQuestionsFromImages, fileToBase64, evaluateHandwrittenWork } from '../lib/gemini';
import type { Difficulty } from '../lib/gemini';
import { uploadHomeworkFiles, uploadRoughWorkFile } from '../lib/storage';

export interface Question {
    id: string;
    text: string;
    options: string[];
    correctAnswerIndex: number;
    explanation?: string;
    topic?: string;
    distractorAnalysis?: Record<string, string>;
    socraticHint?: string;
}

export interface Test {
    id: string;
    homeworkId?: string;
    title: string;
    subject: string;
    difficulty?: Difficulty;
    duration: string;
    status: 'pending' | 'completed';
    dueDate?: string;
    score?: number;
    completedAt?: string;
    studentAnswers?: Record<string, number>;
    questions: Question[];
    sourceFiles?: string[];
    roughWorkUrl?: string;
    roughWorkEvaluation?: RoughWorkEvaluation;
}

export interface StudentProgressItem {
    id: string;
    studentId?: string;
    childId?: string;
    subject: string;
    topic: string;
    masteryScore: number;
    attemptsCount: number;
    lastPracticedAt: string;
}

export interface LinkedChild {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
}

interface AppState {
    tests: Test[];
    progress: StudentProgressItem[];
    childrenList: LinkedChild[];
    isLoading: boolean;
    isGenerating: boolean;
    fetchTests: () => Promise<void>;
    fetchProgress: (targetId?: string) => Promise<void>;
    fetchChildren: () => Promise<void>;
    uploadHomework: (files: File[], subject: string, dueDate: string | null) => Promise<string | null>;
    generateTest: (testId: string, files: File[], difficulty: Difficulty, customInstructions?: string, questionCount?: number) => Promise<void>;
    generateRemedialTest: (topic: string, subject: string) => Promise<string | null>;
    uploadAndEvaluateRoughWork: (testId: string, files: File[]) => Promise<RoughWorkEvaluation | null>;
    deleteTest: (testId: string) => Promise<void>;
    submitTest: (testId: string, answers: Record<string, number>) => Promise<void>;
}

export const DEMO_SAMPLE_TESTS: Test[] = [
    {
        id: 'demo-test-1',
        title: 'Maths: Algebraic Expressions & Equations',
        subject: 'Mathematics',
        duration: '15 mins',
        status: 'completed',
        dueDate: '2026-11-15',
        score: 85,
        completedAt: new Date().toISOString(),
        studentAnswers: {
            'demo-q1': 1,
            'demo-q2': 0,
            'demo-q3': 2,
        },
        roughWorkUrl: 'https://images.unsplash.com/photo-1596495577886-d920f1fb7238?w=800&auto=format&fit=crop&q=80',
        roughWorkEvaluation: {
            transcribedSummary: 'Student set up the linear equation 2x + 6 = 14 correctly, subtracted 6 to get 2x = 8, and divided by 2 to find x = 4.',
            overallFeedback: 'Excellent step-by-step problem setup and clear handwriting. Method and final answer are completely accurate.',
            accuracyScore: 90,
            evaluatedAt: new Date().toISOString(),
            stepMarks: {
                'demo-q1': {
                    questionNumber: 1,
                    questionId: 'demo-q1',
                    methodMark: 1,
                    calculationMark: 1,
                    finalMark: 1,
                    maxMarks: 3,
                    transcribedSteps: [
                        'Line 1: 2x + 6 = 14',
                        'Line 2: 2x = 14 - 6 = 8',
                        'Line 3: x = 8 / 2 = 4'
                    ],
                    stepFeedback: 'Spot on execution from formula to final answer.',
                    identifiedErrorType: null
                },
                'demo-q2': {
                    questionNumber: 2,
                    questionId: 'demo-q2',
                    methodMark: 1,
                    calculationMark: 0,
                    finalMark: 0,
                    maxMarks: 3,
                    transcribedSteps: [
                        'Line 1: 3(x - 2) = 9',
                        'Line 2: 3x - 2 = 9 (Forgot to distribute 3 to 2)',
                        'Line 3: 3x = 11, x = 11/3'
                    ],
                    stepFeedback: 'Identified correct linear structure but forgot distributive property over parentheses.',
                    identifiedErrorType: 'Distributive property omission'
                }
            }
        },
        questions: [
            {
                id: 'demo-q1',
                text: 'Solve for x: 2x + 6 = 14',
                options: ['x = 3', 'x = 4', 'x = 5', 'x = 10'],
                correctAnswerIndex: 1,
                explanation: 'Subtract 6 from both sides to get 2x = 8. Divide both sides by 2 to get x = 4.',
                topic: 'Linear Equations',
                socraticHint: 'What happens if you subtract 6 from both sides first?',
                distractorAnalysis: {
                    '0': 'Arithmetic error during subtraction (14 - 6 = 6 instead of 8).',
                    '2': 'Added 6 instead of subtracting (2x = 20, x = 10 / 2 = 5).',
                    '3': 'Subtracted 6 but forgot to divide by coefficient 2.'
                }
            },
            {
                id: 'demo-q2',
                text: 'Expand and solve: 3(x - 2) = 9',
                options: ['x = 5', 'x = 3', 'x = 11/3', 'x = 15'],
                correctAnswerIndex: 0,
                explanation: 'Distribute 3: 3x - 6 = 9. Add 6 to both sides: 3x = 15. Divide by 3: x = 5.',
                topic: 'Distributive Property',
                socraticHint: 'Remember to multiply the 3 outside the brackets by both terms inside.',
                distractorAnalysis: {
                    '1': 'Divided 9 by 3 but forgot the -2 term inside parentheses.',
                    '2': 'Distributed 3 to x but forgot to multiply 3 with 2 (wrote 3x - 2 = 9).',
                    '3': 'Added 6 to 9 but forgot to divide by 3 at the end.'
                }
            },
            {
                id: 'demo-q3',
                text: 'If 5y = 35, what is the value of y + 4?',
                options: ['7', '9', '11', '14'],
                correctAnswerIndex: 2,
                explanation: 'Divide both sides by 5: y = 7. Then evaluate y + 4: 7 + 4 = 11.',
                topic: 'Two-step Algebraic Evaluation',
                socraticHint: 'First solve for y, then remember to add 4 to your answer!',
                distractorAnalysis: {
                    '0': 'Found y = 7 correctly but forgot the second step of adding 4.',
                    '1': 'Calculation error when adding 4 to 7 (7 + 2).',
                    '3': 'Multiplied 7 by 2 instead of adding 4.'
                }
            }
        ]
    },
    {
        id: 'demo-test-2',
        title: 'Science: Laws of Motion & Friction',
        subject: 'Science',
        duration: '15 mins',
        status: 'pending',
        dueDate: '2026-11-20',
        questions: [
            {
                id: 'demo-s1',
                text: 'Which of Newton\'s laws explains why passengers jerk forward when a bus suddenly stops?',
                options: ['Newton\'s First Law (Inertia)', 'Newton\'s Second Law (F = ma)', 'Newton\'s Third Law (Action-Reaction)', 'Law of Gravitation'],
                correctAnswerIndex: 0,
                explanation: 'Newton\'s First Law states an object in motion stays in motion unless acted on by an external force. Passengers keep moving forward due to inertia.',
                topic: 'Newton\'s Laws',
                socraticHint: 'Think about the tendency of a body to resist changes in its state of motion.',
                distractorAnalysis: {
                    '1': 'Confused inertia with the quantitative calculation of force (F=ma).',
                    '2': 'Confused action-reaction pairs with the tendency of an object to resist sudden stops.',
                    '3': 'Gravitation governs attraction between masses, not passenger inertia.'
                }
            },
            {
                id: 'demo-s2',
                text: 'A force of 20 N acts on a mass of 4 kg. What is the acceleration produced?',
                options: ['80 m/s²', '16 m/s²', '5 m/s²', '0.2 m/s²'],
                correctAnswerIndex: 2,
                explanation: 'According to F = ma, a = F / m = 20 N / 4 kg = 5 m/s².',
                topic: 'Force and Acceleration',
                socraticHint: 'Use the formula a = F / m.',
                distractorAnalysis: {
                    '0': 'Multiplied force and mass (20 * 4) instead of dividing.',
                    '1': 'Subtracted mass from force (20 - 4).',
                    '3': 'Divided mass by force (4 / 20) instead of force by mass.'
                }
            }
        ]
    }
];

export const DEMO_SAMPLE_PROGRESS: StudentProgressItem[] = [
    {
        id: 'prog-1',
        studentId: 'superuser-student-001',
        subject: 'Mathematics',
        topic: 'Linear Equations',
        masteryScore: 88,
        attemptsCount: 3,
        lastPracticedAt: new Date().toISOString()
    },
    {
        id: 'prog-2',
        studentId: 'superuser-student-001',
        subject: 'Mathematics',
        topic: 'Distributive Property',
        masteryScore: 45,
        attemptsCount: 2,
        lastPracticedAt: new Date().toISOString()
    },
    {
        id: 'prog-3',
        studentId: 'superuser-student-001',
        subject: 'Science',
        topic: 'Newton\'s Laws',
        masteryScore: 92,
        attemptsCount: 4,
        lastPracticedAt: new Date().toISOString()
    }
];

const useAppStore = create<AppState>((set, get) => ({
    tests: [],
    progress: [],
    childrenList: [],
    isLoading: false,
    isGenerating: false,

    fetchTests: async () => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        if (user.role === 'student' && !user.parentId) {
            // Student not linked to any parent yet
            set({ tests: [], isLoading: false });
            return;
        }

        set({ isLoading: true });
        try {
            // Filter tests by Parent/Student association
            let query = supabase.from('tests').select('*');

            if (user.role === 'parent') {
                query = query.eq('parent_id', user.id);
            } else if (user.role === 'student' && user.parentId) {
                query = query.eq('parent_id', user.parentId);
            }

            const { data: testsData, error: testsError } = await query
                .order('created_at', { ascending: false });

            if (testsError) throw testsError;

            if (!testsData || testsData.length === 0) {
                if (user.id.startsWith('superuser-')) {
                    set({ tests: DEMO_SAMPLE_TESTS, isLoading: false });
                    return;
                }
                set({ tests: [], isLoading: false });
                return;
            }

            // Then fetch all questions for these tests
            const testIds = testsData.map(t => t.id);
            const { data: questionsData, error: questionsError } = await supabase
                .from('questions')
                .select('*')
                .in('test_id', testIds);

            if (questionsError) throw questionsError;

            // Map them into our frontend format
            const mappedTests: Test[] = testsData.map((t: DatabaseTest) => {
                const testQuestions = (questionsData || [])
                    .filter((q: DatabaseQuestion) => q.test_id === t.id)
                    .map((q: DatabaseQuestion): Question => ({
                        id: q.id,
                        text: q.text,
                        options: q.options,
                        correctAnswerIndex: q.correct_answer_index,
                        explanation: q.explanation,
                        topic: q.topic,
                        distractorAnalysis: q.distractor_analysis,
                        socraticHint: q.socratic_hint
                    }));

                return {
                    id: t.id,
                    homeworkId: t.homework_id ?? undefined,
                    title: t.title,
                    subject: t.subject,
                    duration: t.duration,
                    status: (t.status === 'completed' ? 'completed' : 'pending'),
                    dueDate: t.due_date ?? undefined,
                    score: t.score ?? undefined,
                    completedAt: t.completed_at ?? undefined,
                    studentAnswers: t.student_answers ?? undefined,
                    questions: testQuestions,
                    roughWorkUrl: t.rough_work_url ?? undefined,
                    roughWorkEvaluation: t.rough_work_evaluation ?? undefined
                };
            });

            set({ tests: mappedTests });
        } catch (error) {
            console.error('Error fetching tests:', error);
            if (user.id.startsWith('superuser-')) {
                set({ tests: DEMO_SAMPLE_TESTS });
            }
        } finally {
            set({ isLoading: false });
        }
    },

    fetchProgress: async (targetId?: string) => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        try {
            let query = supabase
                .from('student_progress')
                .select('*')
                .order('last_practiced_at', { ascending: false });

            if (targetId) {
                query = query.or(`student_id.eq.${targetId},child_id.eq.${targetId}`);
            } else if (user.role === 'student') {
                query = query.eq('student_id', user.id);
            }

            const { data, error } = await query;
            if (!error && data && data.length > 0) {
                set({
                    progress: data.map((p: any) => ({
                        id: p.id,
                        studentId: p.student_id,
                        childId: p.child_id,
                        subject: p.subject,
                        topic: p.topic,
                        masteryScore: Number(p.mastery_score) || 0,
                        attemptsCount: p.attempts_count || 1,
                        lastPracticedAt: p.last_practiced_at
                    }))
                });
            } else if (user.id.startsWith('superuser-') || error) {
                set({ progress: DEMO_SAMPLE_PROGRESS });
            }
        } catch (err) {
            console.error('Error fetching student progress:', err);
            if (user.id.startsWith('superuser-')) {
                set({ progress: DEMO_SAMPLE_PROGRESS });
            }
        }
    },

    fetchChildren: async () => {
        const user = useAuthStore.getState().user;
        if (!user || user.role !== 'parent') return;

        try {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('id, name, email, avatar_url, role')
                .eq('parent_id', user.id);

            if (!error && profiles && profiles.length > 0) {
                set({
                    childrenList: profiles.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        email: p.email,
                        avatarUrl: p.avatar_url,
                        role: p.role
                    }))
                });
            } else if (user.id === 'superuser-parent-001' || error) {
                set({
                    childrenList: [{
                        id: 'superuser-student-001',
                        name: 'Alex (Superuser Student)',
                        email: 'student@hometutor.app',
                        role: 'student'
                    }]
                });
            }
        } catch (err) {
            console.error('Error fetching children:', err);
            if (user.id === 'superuser-parent-001') {
                set({
                    childrenList: [{
                        id: 'superuser-student-001',
                        name: 'Alex (Superuser Student)',
                        email: 'student@hometutor.app',
                        role: 'student'
                    }]
                });
            }
        }
    },

    uploadHomework: async (files: File[], subject: string, dueDate: string | null = null): Promise<string | null> => {
        const user = useAuthStore.getState().user;
        if (!user) return null;

        const fileName = files.length === 1
            ? files[0].name
            : `${files.length} files`;
        const newTitle = `${subject}: ${fileName}`;

        try {
            // Insert the test record — questions added after AI generation
            const { data: testData, error: testError } = await supabase
                .from('tests')
                .insert([{
                    title: newTitle,
                    subject,
                    duration: '15 mins',
                    status: 'pending',
                    parent_id: user.role === 'parent' ? user.id : null,
                    due_date: dueDate,
                }])
                .select()
                .single();

            if (testError) throw testError;

            // Trigger file upload to storage in background if files are provided
            if (files.length > 0 && user.id && testData?.id) {
                uploadHomeworkFiles(user.id, testData.id, files).catch(err => {
                    console.warn('Storage upload note:', err);
                });
            }

            const newFrontendTest: Test = {
                id: testData.id,
                title: testData.title,
                subject: testData.subject,
                duration: testData.duration,
                status: testData.status,
                dueDate: testData.due_date ?? undefined,
                sourceFiles: files.map(f => f.name),
                questions: []
            };

            set(state => ({ tests: [newFrontendTest, ...state.tests] }));
            return testData.id;

        } catch (error) {
            console.error('Error uploading homework:', error);
            if (user.id.startsWith('superuser-') || error) {
                const fallbackId = `test_${Date.now()}`;
                const fallbackTest: Test = {
                    id: fallbackId,
                    title: newTitle,
                    subject,
                    duration: '15 mins',
                    status: 'pending',
                    dueDate: dueDate ?? undefined,
                    sourceFiles: files.map(f => f.name),
                    questions: []
                };
                set(state => ({ tests: [fallbackTest, ...state.tests] }));
                return fallbackId;
            }
            return null;
        }
    },

    generateTest: async (testId: string, files: File[], difficulty: Difficulty, customInstructions?: string, questionCount: number = 5) => {
        set({ isGenerating: true });
        const test = get().tests.find(t => t.id === testId);
        if (!test) { set({ isGenerating: false }); return; }

        try {
            // 1. Enforce Subscription Quota / Daily Limit Check
            const user = useAuthStore.getState().user;
            if (user?.id) {
                const { data: limitCheck, error: limitErr } = await supabase.rpc('check_and_record_test_generation', {
                    p_user_id: user.id
                });

                if (!limitErr && limitCheck && limitCheck.allowed === false) {
                    throw new Error(limitCheck.message || 'Daily limit reached. Please upgrade to Pro for unlimited tests.');
                }

                if (limitCheck?.current_count !== undefined) {
                    useAuthStore.getState().updateUser({ dailyTestsCount: limitCheck.current_count });
                }
            }

            // 2. Prepare file data for Edge Function
            let generatedQuestions: Array<{
                text: string;
                options: string[];
                correct_answer_index: number;
                explanation?: string;
                topic?: string;
                difficulty?: string;
                distractor_analysis?: Record<string, string>;
                socratic_hint?: string;
            }> = [];

            const filesData = await Promise.all(
                files.map(async (f) => ({
                    base64Data: await fileToBase64(f),
                    mimeType: f.type || 'image/jpeg',
                }))
            );

            // 3. Try Supabase Edge Function with seamless fallback to client-side Gemini
            try {
                const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('process-homework', {
                    body: {
                        homeworkId: test.homeworkId || testId,
                        files: filesData,
                        subject: test.subject,
                        difficulty,
                        curriculumBoard: user?.curriculumBoard || 'CBSE',
                        gradeLevel: user?.gradeLevel || 5,
                        customInstructions,
                        questionCount,
                    },
                });

                if (edgeErr) throw edgeErr;

                if (edgeData?.questions && Array.isArray(edgeData.questions) && edgeData.questions.length > 0) {
                    generatedQuestions = edgeData.questions;
                } else {
                    throw new Error('Invalid response from Edge Function');
                }
            } catch (edgeInvocationErr: any) {
                // If it's a 403 quota error from Edge Function, rethrow directly
                if (edgeInvocationErr.context?.status === 403 || edgeInvocationErr.message?.includes('limit')) {
                    throw edgeInvocationErr;
                }
                console.warn('Edge Function fallback to client-side Gemini:', edgeInvocationErr.message || edgeInvocationErr);
                generatedQuestions = await generateQuestionsFromImages(
                    files,
                    test.subject,
                    difficulty,
                    customInstructions,
                    questionCount,
                    user?.curriculumBoard || 'CBSE',
                    user?.gradeLevel || 5
                );
            }

            // 4. Save questions into Supabase (gracefully fallback if columns are not yet in remote DB)
            const questionsToInsert = generatedQuestions.map((q, idx) => ({
                test_id: testId,
                text: q.text,
                options: q.options,
                correct_answer_index: q.correct_answer_index,
                explanation: q.explanation,
                topic: q.topic,
                difficulty: q.difficulty || difficulty,
                order_index: idx,
                distractor_analysis: q.distractor_analysis || {},
                socratic_hint: q.socratic_hint || null,
            }));

            let savedQuestions: any[] | null = null;
            const { data: insertedData, error: qError } = await supabase
                .from('questions')
                .insert(questionsToInsert)
                .select();

            if (qError) {
                // If remote DB does not yet have distractor_analysis or socratic_hint columns, insert base fields
                if (qError.message?.includes('column') || qError.code === '42703') {
                    console.warn('Distractor/Socratic columns not yet present in remote DB, falling back to base columns:', qError.message);
                    const baseQuestions = questionsToInsert.map(({ distractor_analysis, socratic_hint, ...base }) => base);
                    const { data: fallbackData, error: fallbackErr } = await supabase
                        .from('questions')
                        .insert(baseQuestions)
                        .select();
                    if (fallbackErr) throw fallbackErr;
                    savedQuestions = fallbackData;
                } else {
                    throw qError;
                }
            } else {
                savedQuestions = insertedData;
            }

            // 5. Update test status to remain pending but now has questions
            await supabase.from('tests').update({
                duration: `${generatedQuestions.length * 2} mins`,
                difficulty
            }).eq('id', testId);

            // 6. Update local state with real questions, retaining pedagogical fields
            set(state => ({
                tests: state.tests.map(t => t.id === testId ? {
                    ...t,
                    difficulty,
                    duration: `${generatedQuestions.length * 2} mins`,
                    questions: generatedQuestions.map((gq, idx) => ({
                        id: savedQuestions?.[idx]?.id || `q_${Date.now()}_${idx}`,
                        text: gq.text,
                        options: gq.options,
                        correctAnswerIndex: gq.correct_answer_index,
                        explanation: gq.explanation,
                        topic: gq.topic,
                        distractorAnalysis: gq.distractor_analysis,
                        socraticHint: gq.socratic_hint,
                    }))
                } : t)
            }));

        } catch (error) {
            console.error('Error generating test with AI:', error);
            throw error; // Re-throw so UI can show error state
        } finally {
            set({ isGenerating: false });
        }
    },

    generateRemedialTest: async (topic: string, subject: string): Promise<string | null> => {
        const user = useAuthStore.getState().user;
        if (!user) return null;

        try {
            const title = `Diagnostic Drill: ${topic}`;
            const { data: testData, error: testError } = await supabase
                .from('tests')
                .insert([{
                    title,
                    subject,
                    duration: '6 mins',
                    status: 'pending',
                    parent_id: user.role === 'parent' ? user.id : (user.parentId || null),
                    difficulty: 'intermediate',
                }])
                .select()
                .single();

            if (testError) throw testError;

            const newFrontendTest: Test = {
                id: testData.id,
                title: testData.title,
                subject: testData.subject,
                duration: testData.duration,
                status: testData.status,
                difficulty: 'intermediate',
                questions: []
            };

            set(state => ({ tests: [newFrontendTest, ...state.tests] }));

            // Trigger AI test generation with targeted prompt for misconceptions in this topic
            const remedialPrompt = `Generate a targeted 3-question diagnostic assessment strictly focusing on core concepts and common student misconceptions in the topic "${topic}" (${subject}). Ensure each wrong option targets a specific cognitive error.`;

            await get().generateTest(testData.id, [], 'intermediate', remedialPrompt, 3);
            return testData.id;
        } catch (error) {
            console.error('Error creating remedial test:', error);
            return null;
        }
    },

    uploadAndEvaluateRoughWork: async (testId: string, files: File[]): Promise<RoughWorkEvaluation | null> => {
        const user = useAuthStore.getState().user;
        if (!user || files.length === 0) return null;

        const test = get().tests.find(t => t.id === testId);
        if (!test) return null;

        try {
            // 1. Upload rough work file to Supabase storage bucket (with fallback)
            const roughWorkUrl = await uploadRoughWorkFile(user.id, testId, files[0]);

            // 2. Evaluate handwritten steps using Gemini Vision
            const evaluation = await evaluateHandwrittenWork(files, test.questions, test.studentAnswers);

            // 3. Persist to Supabase if columns are present
            try {
                const { error } = await supabase
                    .from('tests')
                    .update({
                        rough_work_url: roughWorkUrl,
                        rough_work_evaluation: evaluation,
                    })
                    .eq('id', testId);

                if (error) {
                    console.warn('Rough work columns not yet migrated in remote DB:', error.message);
                }
            } catch (dbErr) {
                console.warn('DB update note for rough work:', dbErr);
            }

            // 4. Update local Zustand state
            set(state => ({
                tests: state.tests.map(t => t.id === testId ? {
                    ...t,
                    roughWorkUrl,
                    roughWorkEvaluation: evaluation,
                } : t)
            }));

            return evaluation;
        } catch (error) {
            console.error('Error evaluating handwritten work:', error);
            throw error;
        }
    },

    deleteTest: async (testId: string) => {
        try {
            // Delete questions first (FK constraint)
            try {
                await supabase.from('questions').delete().eq('test_id', testId);
            } catch {}
            try {
                await supabase.from('tests').delete().eq('id', testId);
            } catch {}
        } catch (error) {
            console.error('Error deleting test:', error);
        } finally {
            set(state => ({ tests: state.tests.filter(t => t.id !== testId) }));
        }
    },

    submitTest: async (testId: string, answers: Record<string, number>) => {
        try {
            // Find test locally to calculate score
            const test = get().tests.find(t => t.id === testId);
            if (!test) return;

            let correct = 0;
            test.questions.forEach(q => {
                if (answers[q.id] === q.correctAnswerIndex) correct++;
            });
            let score = Math.round((correct / (test.questions.length || 1)) * 100);
            let completedAt = new Date().toISOString();

            // Try server-side secure RPC evaluation first if available
            let rpcHandled = false;
            if (typeof (supabase as any).rpc === 'function') {
                try {
                    const { data: rpcData, error: rpcError } = await (supabase as any).rpc('submit_test_attempt', {
                        p_test_id: testId,
                        p_answers: answers
                    });
                    if (!rpcError && rpcData?.success) {
                        score = rpcData.score;
                        completedAt = rpcData.completed_at || completedAt;
                        rpcHandled = true;
                    }
                } catch {
                    // Fallback to direct table update if RPC not present in environment
                }
            }

            if (!rpcHandled) {
                // Update database directly (fallback for local dev/testing)
                try {
                    await supabase
                        .from('tests')
                        .update({
                            status: 'completed',
                            score: score,
                            completed_at: completedAt,
                            student_answers: answers
                        })
                        .eq('id', testId);
                } catch (updateErr) {
                    console.warn('DB submission sync notice:', updateErr);
                }
            }

            // Always update local state immediately
            set(state => {
                const tests = state.tests.map(t => {
                    if (t.id === testId) {
                        return { ...t, status: 'completed' as const, score, completedAt, studentAnswers: answers };
                    }
                    return t;
                });
                return { tests };
            });

            // Refresh topic mastery & student progress
            get().fetchProgress();

        } catch (error) {
            console.error('Error submitting test:', error);
        }
    }
}));

export default useAppStore;
