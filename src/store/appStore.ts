import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DatabaseTest, DatabaseQuestion, RoughWorkEvaluation } from '../lib/supabase';
import useAuthStore from './authStore';
import { generateQuestionsFromImages, fileToBase64, evaluateHandwrittenWork, verifyDailyHomework, type HomeworkVerificationResult, type SpellingListResult, type MarkedTestAnalysisResult } from '../lib/gemini';
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

export interface DailyHomework {
    id: string;
    parentId: string;
    childId?: string;
    childName?: string;
    title: string;
    subject: string;
    description?: string;
    source: 'whatsapp' | 'teams' | 'diary' | 'manual';
    dueDate?: string;
    createdAt: string;
    assignmentImageUrls: string[]; // parent uploaded photos of school homework from WhatsApp / Teams
    originalFiles?: string[]; // convenience alias
    supportingMaterialUrls?: string[]; // supporting textbook pages, chapter pages, or worksheets uploaded by parent
    extractedContent?: string; // AI OCR extracted questions/text from supporting textbook or worksheet pages

    // Reminder & instructions
    reminderRule?: '1_day_before' | '2_days_before' | 'same_morning';
    isTestOrDictation?: boolean;
    hasCorrectionsNotice?: boolean;
    requiredFilesPrompt?: string;

    // Student submission
    submissionStatus: 'pending' | 'submitted' | 'verified_complete' | 'needs_revision';
    status?: 'pending' | 'submitted' | 'verified' | 'verified_complete' | 'needs_revision'; // convenience alias
    studentSubmissionUrls?: string[]; // photos of student's completed written work
    studentSubmissionFiles?: string[]; // convenience alias
    submittedAt?: string;
    
    // AI Verification Result
    verification?: HomeworkVerificationResult;
    verificationResult?: HomeworkVerificationResult; // convenience alias
}

export interface SavedWorksheet {
    id: string;
    title: string;
    subject: string;
    topic?: string;
    imageUrls: string[];
    uploadedAt: string;
    source: 'upload' | 'teams' | 'homework';
    difficulty?: Difficulty;
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
    dailyHomeworkList: DailyHomework[];
    savedWorksheets: SavedWorksheet[];
    spellingLists: SpellingListResult[];
    testCorrections: MarkedTestAnalysisResult[];
    progress: StudentProgressItem[];
    childrenList: LinkedChild[];
    isLoading: boolean;
    isGenerating: boolean;
    fetchTests: () => Promise<void>;
    fetchDailyHomework: () => Promise<void>;
    addDailyHomework: (data: {
        childId?: string;
        childName?: string;
        title: string;
        subject: string;
        description?: string;
        source: 'whatsapp' | 'teams' | 'diary' | 'manual';
        dueDate?: string;
        files: File[];
        reminderRule?: '1_day_before' | '2_days_before' | 'same_morning';
        isTestOrDictation?: boolean;
        hasCorrectionsNotice?: boolean;
        requiredFilesPrompt?: string;
    }) => Promise<DailyHomework>;
    submitAndVerifyDailyHomework: (homeworkId: string, files: File[], notes?: string) => Promise<DailyHomework | null>;
    addSupportingFilesToHomework: (homeworkId: string, files: File[], extractedContent?: string) => Promise<DailyHomework | null>;
    updateDailyHomework: (homeworkId: string, updates: Partial<DailyHomework>) => void;
    deleteDailyHomework: (homeworkId: string) => Promise<void>;
    saveWorksheetToLibrary: (worksheet: Omit<SavedWorksheet, 'id' | 'uploadedAt'>) => Promise<SavedWorksheet>;
    saveSpellingList: (list: SpellingListResult) => void;
    saveTestCorrection: (correction: MarkedTestAnalysisResult) => void;
    fetchProgress: (targetId?: string) => Promise<void>;
    fetchChildren: () => Promise<void>;
    uploadHomework: (files: File[], subject: string, dueDate: string | null) => Promise<string | null>;
    generateTest: (testId: string, files: File[], difficulty: Difficulty, customInstructions?: string, questionCount?: number) => Promise<void>;
    generateRemedialTest: (topic: string, subject: string) => Promise<string | null>;
    uploadAndEvaluateRoughWork: (testId: string, files: File[]) => Promise<RoughWorkEvaluation | null>;
    deleteTest: (testId: string) => Promise<void>;
    submitTest: (testId: string, answers: Record<string, number>) => Promise<void>;
}

export const DEMO_SAMPLE_TESTS: Test[] = [];
export const DEMO_SAMPLE_PROGRESS: StudentProgressItem[] = [];
export const DEMO_SAMPLE_DAILY_HOMEWORK: DailyHomework[] = [];
export const DEMO_SAVED_WORKSHEETS: SavedWorksheet[] = [];

const useAppStore = create<AppState>((set, get) => ({
    tests: [],
    dailyHomeworkList: [],
    savedWorksheets: (() => {
        try {
            const raw = localStorage.getItem('hometutor_saved_worksheets');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return parsed.filter((w: any) => !w.id?.startsWith('ws-sample-'));
                }
            }
        } catch {}
        return [];
    })(),
    spellingLists: (() => {
        try {
            const raw = localStorage.getItem('hometutor_spelling_lists');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    })(),
    testCorrections: (() => {
        try {
            const raw = localStorage.getItem('hometutor_test_corrections');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    })(),
    progress: [],
    childrenList: [],
    isLoading: false,
    isGenerating: false,

    saveWorksheetToLibrary: async (data) => {
        const newWs: SavedWorksheet = {
            ...data,
            id: `ws-${Date.now()}`,
            uploadedAt: new Date().toISOString()
        };
        const updated = [newWs, ...get().savedWorksheets];
        set({ savedWorksheets: updated });
        try {
            localStorage.setItem('hometutor_saved_worksheets', JSON.stringify(updated));
        } catch (e) {
            console.warn('LocalStorage save error:', e);
        }
        return newWs;
    },

    saveSpellingList: (list: SpellingListResult) => {
        const updated = [list, ...get().spellingLists.filter(l => l.chapterTitle !== list.chapterTitle)];
        set({ spellingLists: updated });
        try {
            localStorage.setItem('hometutor_spelling_lists', JSON.stringify(updated));
        } catch (e) {
            console.warn('LocalStorage save error:', e);
        }
    },

    saveTestCorrection: (correction: MarkedTestAnalysisResult) => {
        const updated = [correction, ...get().testCorrections];
        set({ testCorrections: updated });
        try {
            localStorage.setItem('hometutor_test_corrections', JSON.stringify(updated));
        } catch (e) {
            console.warn('LocalStorage save error:', e);
        }
    },

    fetchDailyHomework: async () => {
        try {
            const raw = localStorage.getItem('hometutor_daily_homework');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    const realItems = parsed.filter((h: any) => !h.id?.startsWith('dh-demo-'));
                    set({ dailyHomeworkList: realItems });
                    localStorage.setItem('hometutor_daily_homework', JSON.stringify(realItems));
                    return;
                }
            }
            set({ dailyHomeworkList: [] });
        } catch (e) {
            console.warn('Error loading daily homework:', e);
            set({ dailyHomeworkList: [] });
        }
    },

    addDailyHomework: async (data) => {
        const user = useAuthStore.getState().user;
        const parentId = user?.id || 'parent-user';

        // Convert files to data URLs for persistent client storage & previews
        const imageUrls = await Promise.all(
            data.files.map(async (file) => {
                try {
                    const b64 = await fileToBase64(file);
                    return `data:${file.type || 'image/jpeg'};base64,${b64}`;
                } catch {
                    return URL.createObjectURL(file);
                }
            })
        );

        const newHomework: DailyHomework = {
            id: `dh-${Date.now()}`,
            parentId,
            childId: data.childId,
            childName: data.childName || 'Child',
            title: data.title,
            subject: data.subject,
            description: data.description,
            source: data.source,
            dueDate: data.dueDate,
            createdAt: new Date().toISOString(),
            assignmentImageUrls: imageUrls,
            originalFiles: imageUrls,
            reminderRule: data.reminderRule || '1_day_before',
            isTestOrDictation: data.isTestOrDictation || false,
            hasCorrectionsNotice: data.hasCorrectionsNotice || false,
            requiredFilesPrompt: data.requiredFilesPrompt,
            submissionStatus: 'pending',
            status: 'pending'
        };

        const updated = [newHomework, ...get().dailyHomeworkList];
        set({ dailyHomeworkList: updated });
        try {
            localStorage.setItem('hometutor_daily_homework', JSON.stringify(updated));
        } catch (e) {
            console.warn('LocalStorage save warning:', e);
        }

        // FR-11: Every uploaded worksheet is saved in a library
        if (imageUrls.length > 0) {
            get().saveWorksheetToLibrary({
                title: data.title,
                subject: data.subject,
                topic: data.description || `${data.subject} homework`,
                imageUrls,
                source: data.source === 'teams' ? 'teams' : 'homework'
            });
        }

        return newHomework;
    },

    submitAndVerifyDailyHomework: async (homeworkId: string, files: File[], notes?: string) => {
        const item = get().dailyHomeworkList.find(h => h.id === homeworkId);
        if (!item) return null;

        // Convert student files to data URLs
        const studentUrls = await Promise.all(
            files.map(async (file) => {
                try {
                    const b64 = await fileToBase64(file);
                    return `data:${file.type || 'image/jpeg'};base64,${b64}`;
                } catch {
                    return URL.createObjectURL(file);
                }
            })
        );

        // Convert assignment image URLs back to File objects for Gemini vision
        const assignmentFiles = await Promise.all(
            item.assignmentImageUrls.map(async (url, idx) => {
                if (url.startsWith('data:')) {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    return new File([blob], `assignment-${idx}.jpg`, { type: blob.type || 'image/jpeg' });
                } else {
                    return new File([''], `assignment-${idx}.jpg`, { type: 'image/jpeg' });
                }
            })
        );

        const verification = await verifyDailyHomework(
            assignmentFiles,
            files,
            item.subject,
            item.title,
            notes ? `${item.description || ''} (Student Notes: ${notes})` : item.description
        );

        const isDone = verification.isComplete;
        const updatedItem: DailyHomework = {
            ...item,
            submissionStatus: isDone ? 'verified_complete' : 'needs_revision',
            status: isDone ? 'verified' : 'needs_revision',
            studentSubmissionUrls: studentUrls,
            studentSubmissionFiles: studentUrls,
            submittedAt: new Date().toISOString(),
            verification,
            verificationResult: verification
        };

        const updatedList = get().dailyHomeworkList.map(h => h.id === homeworkId ? updatedItem : h);
        set({ dailyHomeworkList: updatedList });
        try {
            localStorage.setItem('hometutor_daily_homework', JSON.stringify(updatedList));
        } catch (e) {
            console.warn('LocalStorage save warning:', e);
        }

        return updatedItem;
    },

    addSupportingFilesToHomework: async (homeworkId: string, files: File[], extractedContent?: string) => {
        const item = get().dailyHomeworkList.find(h => h.id === homeworkId);
        if (!item || files.length === 0) return null;

        const newUrls = await Promise.all(
            files.map(async (file) => {
                try {
                    const b64 = await fileToBase64(file);
                    return `data:${file.type || 'image/jpeg'};base64,${b64}`;
                } catch {
                    return URL.createObjectURL(file);
                }
            })
        );

        const existingAssignmentUrls = item.assignmentImageUrls || [];
        const existingOriginalUrls = item.originalFiles || [];
        const existingSupportingUrls = item.supportingMaterialUrls || [];

        const updatedAssignmentUrls = [...existingAssignmentUrls, ...newUrls];
        const updatedOriginalUrls = [...existingOriginalUrls, ...newUrls];
        const updatedSupportingUrls = [...existingSupportingUrls, ...newUrls];

        const updatedItem: DailyHomework = {
            ...item,
            assignmentImageUrls: updatedAssignmentUrls,
            originalFiles: updatedOriginalUrls,
            supportingMaterialUrls: updatedSupportingUrls,
            extractedContent: extractedContent || item.extractedContent
        };

        const updatedList = get().dailyHomeworkList.map(h => h.id === homeworkId ? updatedItem : h);
        set({ dailyHomeworkList: updatedList });

        try {
            localStorage.setItem('hometutor_daily_homework', JSON.stringify(updatedList));
        } catch (e) {
            console.warn('LocalStorage save warning:', e);
        }

        // FR-11: Save uploaded supporting worksheet/pages to library for later practice
        if (newUrls.length > 0) {
            get().saveWorksheetToLibrary({
                title: `${item.title} (Supporting Material)`,
                subject: item.subject,
                topic: item.description || `${item.subject} textbook pages`,
                imageUrls: newUrls,
                source: 'homework'
            });
        }

        return updatedItem;
    },

    updateDailyHomework: (homeworkId: string, updates: Partial<DailyHomework>) => {
        const updatedList = get().dailyHomeworkList.map(h => h.id === homeworkId ? { ...h, ...updates } : h);
        set({ dailyHomeworkList: updatedList });
        try {
            localStorage.setItem('hometutor_daily_homework', JSON.stringify(updatedList));
        } catch (e) {
            console.warn('LocalStorage save warning:', e);
        }
    },

    deleteDailyHomework: async (homeworkId: string) => {
        const updated = get().dailyHomeworkList.filter(h => h.id !== homeworkId);
        set({ dailyHomeworkList: updated });
        try {
            localStorage.setItem('hometutor_daily_homework', JSON.stringify(updated));
        } catch (e) {
            console.warn('LocalStorage save warning:', e);
        }
    },

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
            set({ tests: [] });
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
            } else {
                set({ progress: [] });
            }
        } catch (err) {
            console.error('Error fetching student progress:', err);
            set({ progress: [] });
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
