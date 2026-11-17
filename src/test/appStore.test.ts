import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// ─── Mock supabase ───────────────────────────────────────────────────────────
const makeChain = (defaultResult: any = { data: [], error: null }) => {
  const chain: any = {};
  ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'single'].forEach(m => {
    chain[m] = vi.fn().mockReturnThis();
  });
  chain.then = (resolve: any) => Promise.resolve(defaultResult).then(resolve);
  return chain;
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(() => makeChain()),
    rpc: vi.fn().mockResolvedValue({ data: { allowed: true, current_count: 1 }, error: null }),
    functions: {
      invoke: vi.fn().mockRejectedValue(new Error('Edge function offline')),
    },
  },
}));

// ─── Mock gemini ─────────────────────────────────────────────────────────────
vi.mock('../lib/gemini', () => ({
  fileToBase64: vi.fn().mockResolvedValue('mock-base64'),
  generateQuestionsFromImages: vi.fn().mockResolvedValue([
    { text: 'Q1', options: ['A', 'B', 'C', 'D'], correct_answer_index: 0 },
    { text: 'Q2', options: ['A', 'B', 'C', 'D'], correct_answer_index: 1 },
  ]),
  evaluateHandwrittenWork: vi.fn().mockResolvedValue({
    transcribedSummary: 'Transcribed steps',
    overallFeedback: 'Good job',
    accuracyScore: 90,
    evaluatedAt: '2026-10-24T00:00:00.000Z',
    stepMarks: {
      'q-1': {
        questionNumber: 1,
        questionId: 'q-1',
        methodMark: 1,
        calculationMark: 1,
        finalMark: 1,
        maxMarks: 3,
        transcribedSteps: ['step 1'],
        stepFeedback: 'Well done',
        identifiedErrorType: null
      }
    }
  }),
}));

// ─── Mock storage ────────────────────────────────────────────────────────────
vi.mock('../lib/storage', () => ({
  uploadRoughWorkFile: vi.fn().mockResolvedValue('https://supabase.co/storage/v1/object/public/rough-work/mock-url.jpg'),
  uploadHomeworkFiles: vi.fn().mockResolvedValue([]),
}));

import useAppStore from '../store/appStore';
import useAuthStore from '../store/authStore';
import { supabase } from '../lib/supabase';
import { generateQuestionsFromImages } from '../lib/gemini';

const PARENT_USER = { id: 'parent-1', name: 'Parent', email: 'p@p.com', role: 'parent' as const };
const STUDENT_USER = { id: 'student-1', name: 'Student', email: 's@s.com', role: 'student' as const, parentId: 'parent-1' };

const MOCK_TEST_DB = {
  id: 'test-1',
  title: 'Maths: hw.jpg',
  subject: 'Maths',
  duration: '15 mins',
  status: 'pending',
  due_date: null,
  score: null,
  completed_at: null,
  student_answers: null,
};

const MOCK_QUESTION_DB = {
  id: 'q-1',
  test_id: 'test-1',
  text: 'Q1',
  options: ['A', 'B', 'C', 'D'],
  correct_answer_index: 0,
};

const MOCK_QUESTIONS = [
  { text: 'Q1', options: ['A', 'B', 'C', 'D'], correct_answer_index: 0 },
  { text: 'Q2', options: ['A', 'B', 'C', 'D'], correct_answer_index: 1 },
];

beforeEach(() => {
  useAppStore.setState({ tests: [], isLoading: false, isGenerating: false });
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('appStore – fetchTests', () => {
  it('returns empty array when no user is logged in', async () => {
    const { result } = renderHook(() => useAppStore());
    await act(async () => { await result.current.fetchTests(); });
    expect(result.current.tests).toEqual([]);
  });

  it('fetches tests as a parent and maps questions', async () => {
    useAuthStore.setState({ user: PARENT_USER, isAuthenticated: true, isLoading: false });

    const testsChain: any = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [MOCK_TEST_DB], error: null }) };
    const questionsChain: any = { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: [MOCK_QUESTION_DB], error: null }) };
    vi.mocked(supabase.from)
      .mockReturnValueOnce(testsChain)
      .mockReturnValueOnce(questionsChain);

    const { result } = renderHook(() => useAppStore());
    await act(async () => { await result.current.fetchTests(); });

    expect(result.current.tests).toHaveLength(1);
    expect(result.current.tests[0].id).toBe('test-1');
    expect(result.current.tests[0].questions).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches tests as a student using parentId', async () => {
    useAuthStore.setState({ user: STUDENT_USER, isAuthenticated: true, isLoading: false });

    const testsChain: any = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }) };
    vi.mocked(supabase.from).mockReturnValueOnce(testsChain);
    // questions chain for empty test list is skipped (early return)

    const { result } = renderHook(() => useAppStore());
    await act(async () => { await result.current.fetchTests(); });

    expect(result.current.tests).toEqual([]);
  });

  it('sets empty tests when student has no parentId', async () => {
    const studentNoParent = { ...STUDENT_USER, parentId: undefined };
    useAuthStore.setState({ user: studentNoParent, isAuthenticated: true, isLoading: false });

    const { result } = renderHook(() => useAppStore());
    await act(async () => { await result.current.fetchTests(); });

    expect(result.current.tests).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('appStore – uploadHomework', () => {
  it('inserts a test row and updates local state', async () => {
    useAuthStore.setState({ user: PARENT_USER, isAuthenticated: true, isLoading: false });

    const insertChain: any = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: MOCK_TEST_DB, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValueOnce(insertChain);

    const file = new File(['content'], 'hw.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useAppStore());
    let testId: string | null = null;
    await act(async () => { testId = await result.current.uploadHomework([file], 'Maths', null); });

    expect(testId).toBe('test-1');
    expect(result.current.tests).toHaveLength(1);
    expect(result.current.tests[0].subject).toBe('Maths');
  });

  it('returns null when not authenticated', async () => {
    const { result } = renderHook(() => useAppStore());
    const file = new File(['x'], 'hw.jpg', { type: 'image/jpeg' });
    let testId: string | null = 'initial';
    await act(async () => { testId = await result.current.uploadHomework([file], 'Maths', null); });
    expect(testId).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('appStore – generateTest', () => {
  it('calls Gemini, saves questions, and updates test in state', async () => {
    useAuthStore.setState({ user: PARENT_USER, isAuthenticated: true, isLoading: false });

    // Seed a pending test
    useAppStore.setState({
      tests: [{ id: 'test-1', title: 'T', subject: 'Maths', duration: '15 mins', status: 'pending', questions: [] }],
    });

    const savedQs = MOCK_QUESTIONS.map((q, i) => ({ ...q, id: `q-${i}`, test_id: 'test-1', correct_answer_index: q.correct_answer_index }));

    const qInsertChain: any = { insert: vi.fn().mockReturnThis(), select: vi.fn().mockResolvedValue({ data: savedQs, error: null }) };
    const tUpdateChain: any = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(qInsertChain)
      .mockReturnValueOnce(tUpdateChain);

    const file = new File(['x'], 'hw.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useAppStore());
    await act(async () => { await result.current.generateTest('test-1', [file], 'basic'); });

    expect(generateQuestionsFromImages).toHaveBeenCalledWith([file], 'Maths', 'basic', undefined, 5, 'CBSE', 5);
    expect(result.current.tests[0].questions).toHaveLength(2);
    expect(result.current.isGenerating).toBe(false);
  });

  it('creates diagnostic remedial test and triggers targeted AI generation', async () => {
    useAuthStore.setState({ user: PARENT_USER });
    const mockInsertedTest = {
      id: 'remedial-1',
      title: 'Diagnostic Drill: Fractions',
      subject: 'Maths',
      duration: '6 mins',
      status: 'pending',
      difficulty: 'intermediate',
    };

    const tInsertChain: any = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockInsertedTest, error: null }),
    };

    const qInsertChain: any = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [{ id: 'q-1' }, { id: 'q-2' }], error: null }),
    };

    const tUpdateChain: any = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(tInsertChain)
      .mockReturnValueOnce(qInsertChain)
      .mockReturnValueOnce(tUpdateChain);

    const { result } = renderHook(() => useAppStore());
    let remedialId: string | null = null;
    await act(async () => {
      remedialId = await result.current.generateRemedialTest('Fractions', 'Maths');
    });

    expect(remedialId).toBe('remedial-1');
    expect(result.current.tests[0].title).toBe('Diagnostic Drill: Fractions');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('appStore – deleteTest', () => {
  it('deletes questions and test from DB and removes from state', async () => {
    useAppStore.setState({
      tests: [{ id: 'test-1', title: 'T', subject: 'Maths', duration: '15 mins', status: 'pending', questions: [] }],
    });

    const qDeleteChain: any = { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    const tDeleteChain: any = { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
    vi.mocked(supabase.from)
      .mockReturnValueOnce(qDeleteChain)
      .mockReturnValueOnce(tDeleteChain);

    const { result } = renderHook(() => useAppStore());
    await act(async () => { await result.current.deleteTest('test-1'); });

    expect(result.current.tests).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('appStore – submitTest (score calculation)', () => {
  const questions = [
    { id: 'q1', text: 'Q1', options: ['A', 'B', 'C', 'D'], correctAnswerIndex: 0 },
    { id: 'q2', text: 'Q2', options: ['A', 'B', 'C', 'D'], correctAnswerIndex: 2 },
    { id: 'q3', text: 'Q3', options: ['A', 'B', 'C', 'D'], correctAnswerIndex: 1 },
    { id: 'q4', text: 'Q4', options: ['A', 'B', 'C', 'D'], correctAnswerIndex: 3 },
  ];

  beforeEach(() => {
    useAppStore.setState({
      tests: [{ id: 'test-1', title: 'T', subject: 'Maths', duration: '10 mins', status: 'pending', questions }],
    });
  });

  it('calculates 100% score when all answers are correct', async () => {
    const answers = { q1: 0, q2: 2, q3: 1, q4: 3 };
    const updateChain: any = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    vi.mocked(supabase.from).mockReturnValueOnce(updateChain);

    const { result } = renderHook(() => useAppStore());
    await act(async () => { await result.current.submitTest('test-1', answers); });

    expect(result.current.tests[0].score).toBe(100);
    expect(result.current.tests[0].status).toBe('completed');
  });

  it('calculates 50% score when half answers are correct', async () => {
    const answers = { q1: 0, q2: 2, q3: 3, q4: 0 }; // q1, q2 correct
    const updateChain: any = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    vi.mocked(supabase.from).mockReturnValueOnce(updateChain);

    const { result } = renderHook(() => useAppStore());
    await act(async () => { await result.current.submitTest('test-1', answers); });

    expect(result.current.tests[0].score).toBe(50);
  });

  it('calculates 0% score when all answers are wrong', async () => {
    const answers = { q1: 1, q2: 0, q3: 0, q4: 0 };
    const updateChain: any = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    vi.mocked(supabase.from).mockReturnValueOnce(updateChain);

    const { result } = renderHook(() => useAppStore());
    await act(async () => { await result.current.submitTest('test-1', answers); });

    expect(result.current.tests[0].score).toBe(0);
  });

  it('stores studentAnswers in state', async () => {
    const answers = { q1: 0, q2: 2, q3: 1, q4: 3 };
    const updateChain: any = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    vi.mocked(supabase.from).mockReturnValueOnce(updateChain);

    const { result } = renderHook(() => useAppStore());
    await act(async () => { await result.current.submitTest('test-1', answers); });

    expect(result.current.tests[0].studentAnswers).toEqual(answers);
  });

  it('does nothing when testId is not found', async () => {
    const { result } = renderHook(() => useAppStore());
    await act(async () => { await result.current.submitTest('nonexistent', {}); });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('appStore – uploadAndEvaluateRoughWork', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: PARENT_USER as any });
    useAppStore.setState({
      tests: [
        {
          id: 'test-1',
          title: 'Math Test',
          subject: 'Maths',
          duration: '15 mins',
          status: 'completed',
          questions: [
            { id: 'q-1', text: 'Q1', options: ['A', 'B'], correctAnswerIndex: 0 }
          ],
          studentAnswers: { 'q-1': 0 }
        }
      ]
    });
  });

  it('uploads rough work file and saves evaluation to test state and Supabase', async () => {
    const updateChain: any = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    vi.mocked(supabase.from).mockReturnValueOnce(updateChain);

    const { result } = renderHook(() => useAppStore());
    const mockFile = new File(['mock content'], 'rough_work.png', { type: 'image/png' });

    let evaluationResult: any;
    await act(async () => {
      evaluationResult = await result.current.uploadAndEvaluateRoughWork('test-1', [mockFile]);
    });

    expect(evaluationResult).toBeDefined();
    expect(evaluationResult.accuracyScore).toBe(90);
    expect(result.current.tests[0].roughWorkUrl).toBe('https://supabase.co/storage/v1/object/public/rough-work/mock-url.jpg');
    expect(result.current.tests[0].roughWorkEvaluation).toBeDefined();
    expect(result.current.tests[0].roughWorkEvaluation?.stepMarks['q-1'].methodMark).toBe(1);
    expect(supabase.from).toHaveBeenCalledWith('tests');
  });

  it('returns null if no user is logged in', async () => {
    useAuthStore.setState({ user: null });
    const { result } = renderHook(() => useAppStore());
    const mockFile = new File(['mock content'], 'rough_work.png', { type: 'image/png' });

    let evaluationResult: any;
    await act(async () => {
      evaluationResult = await result.current.uploadAndEvaluateRoughWork('test-1', [mockFile]);
    });

    expect(evaluationResult).toBeNull();
  });

  it('returns null if file array is empty', async () => {
    const { result } = renderHook(() => useAppStore());
    let evaluationResult: any;
    await act(async () => {
      evaluationResult = await result.current.uploadAndEvaluateRoughWork('test-1', []);
    });
    expect(evaluationResult).toBeNull();
  });
});
