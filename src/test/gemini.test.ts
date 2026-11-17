import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The gemini module uses import.meta.env.VITE_GEMINI_API_KEY internally.
// We set up vi.stubEnv BEFORE any import that reads the env.
// Note: In Vitest, vi.stubEnv patches import.meta.env values dynamically.

const VALID_QUESTIONS = [
  { text: 'What is 2+2?', options: ['1', '2', '3', '4'], correct_answer_index: 3 },
  { text: 'What is 3+3?', options: ['5', '6', '7', '8'], correct_answer_index: 1 },
  { text: 'What is 4+4?', options: ['6', '7', '8', '9'], correct_answer_index: 2 },
  { text: 'What is 5+5?', options: ['8', '9', '10', '11'], correct_answer_index: 2 },
  { text: 'What is 6+6?', options: ['10', '11', '12', '13'], correct_answer_index: 2 },
];
const VALID_BODY = JSON.stringify(VALID_QUESTIONS);

const makeGeminiResponse = (body: string, status = 200) =>
  new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: body }] } }] }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );

beforeEach(() => {
  vi.stubEnv('VITE_GEMINI_API_KEY', 'mock-key');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeGeminiResponse(VALID_BODY)));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Import must come AFTER stubbing (top-level imports are hoisted, but
// since vitest uses dynamic module resolution with env stubs, we use
// a dynamic import inside each test that needs env-specific behavior,
// and a static import for the happy-path tests.)
import { generateQuestionsFromImages, evaluateHandwrittenWork } from '../lib/gemini';

describe('gemini – generateQuestionsFromImages (no images / text-only)', () => {
  it('returns 5 parsed questions on a successful response', async () => {
    const questions = await generateQuestionsFromImages([], 'Maths', 'basic');
    expect(questions).toHaveLength(5);
    expect(questions[0]).toMatchObject({
      text: expect.any(String),
      options: expect.arrayContaining([expect.any(String)]),
      correct_answer_index: expect.any(Number),
    });
  });

  it('respects questionCount = 3: prompt contains "3 MCQ objects"', async () => {
    const threeQs = VALID_QUESTIONS.slice(0, 3);
    vi.mocked(fetch).mockResolvedValueOnce(makeGeminiResponse(JSON.stringify(threeQs)));

    await generateQuestionsFromImages([], 'Maths', 'basic', undefined, 3);

    const callBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
    );
    const promptText: string =
      callBody.contents[0].parts[callBody.contents[0].parts.length - 1].text;
    expect(promptText).toContain('3 MCQ objects');
  });

  it('uses temperature 0.3 for basic difficulty', async () => {
    await generateQuestionsFromImages([], 'Maths', 'basic');
    const callBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
    );
    expect(callBody.generationConfig.temperature).toBe(0.3);
  });

  it('uses temperature 0.5 for intermediate difficulty', async () => {
    await generateQuestionsFromImages([], 'Maths', 'intermediate');
    const callBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
    );
    expect(callBody.generationConfig.temperature).toBe(0.5);
  });

  it('uses temperature 0.8 for advanced difficulty', async () => {
    await generateQuestionsFromImages([], 'Maths', 'advanced');
    const callBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
    );
    expect(callBody.generationConfig.temperature).toBe(0.8);
  });

  it('includes customInstructions in the prompt', async () => {
    await generateQuestionsFromImages([], 'Maths', 'basic', 'Focus on fractions');
    const callBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
    );
    const promptText: string =
      callBody.contents[0].parts[callBody.contents[0].parts.length - 1].text;
    expect(promptText).toContain('Focus on fractions');
  });

  it('throws "Rate Limit Exceeded" on 429 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'quota' }), { status: 429 })
    );
    await expect(generateQuestionsFromImages([], 'Maths', 'basic')).rejects.toThrow(
      'Rate Limit Exceeded'
    );
  });

  it('throws "AI Model Error (404)" on 404 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
    );
    await expect(generateQuestionsFromImages([], 'Maths', 'basic')).rejects.toThrow(
      'AI Model Error (404)'
    );
  });

  it('throws generic Gemini error for other non-ok status codes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'server error' }), { status: 500 })
    );
    await expect(generateQuestionsFromImages([], 'Maths', 'basic')).rejects.toThrow(
      'Gemini API error: 500'
    );
  });

  it('throws "AI returned an empty response" when text is empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: '' }] } }] }),
        { status: 200 }
      )
    );
    await expect(generateQuestionsFromImages([], 'Maths', 'basic')).rejects.toThrow(
      'AI returned an empty response'
    );
  });

  it('throws "Failed to read AI response" on malformed JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeGeminiResponse('not-valid-json'));
    await expect(generateQuestionsFromImages([], 'Maths', 'basic')).rejects.toThrow(
      'Failed to read AI response'
    );
  });

  it('throws "Failed to read AI response" when response is a non-array JSON object', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeGeminiResponse(JSON.stringify({ message: 'unexpected object' }))
    );
    await expect(generateQuestionsFromImages([], 'Maths', 'basic')).rejects.toThrow(
      'Failed to read AI response'
    );
  });

  it('throws when API key is empty (via env stub)', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    // Need a fresh module import so it re-reads the env
    vi.resetModules();
    const { generateQuestionsFromImages: gen } = await import('../lib/gemini');
    await expect(gen([], 'Maths', 'basic')).rejects.toThrow(
      'Gemini API key is not configured'
    );
  });
});

describe('gemini – evaluateHandwrittenWork', () => {
  const sampleQuestions = [
    {
      id: 'q1',
      text: 'Find x: 2x + 6 = 14',
      options: ['2', '3', '4', '5'],
      correctAnswerIndex: 2,
      explanation: '2x = 8, so x = 4'
    }
  ];

  const mockEvaluationResponse = {
    transcribedSummary: 'Student subtracted 6 from both sides to get 2x = 8, then divided by 2 to get x = 4.',
    overallFeedback: 'Excellent logical steps and clean handwriting!',
    accuracyScore: 100,
    stepMarks: {
      q1: {
        questionNumber: 1,
        questionId: 'q1',
        methodMark: 1,
        calculationMark: 1,
        finalMark: 1,
        maxMarks: 3,
        transcribedSteps: ['2x + 6 = 14', '2x = 14 - 6 = 8', 'x = 8 / 2 = 4'],
        stepFeedback: 'Flawless execution from formula to answer.',
        identifiedErrorType: null
      }
    }
  };

  it('evaluates handwritten work successfully and returns structured marks', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeGeminiResponse(JSON.stringify(mockEvaluationResponse)));
    const file = new File(['fake-image-bytes'], 'rough_work.jpg', { type: 'image/jpeg' });

    const result = await evaluateHandwrittenWork([file], sampleQuestions, { q1: 2 });

    expect(result.accuracyScore).toBe(100);
    expect(result.overallFeedback).toBe('Excellent logical steps and clean handwriting!');
    expect(result.stepMarks['q1'].methodMark).toBe(1);
    expect(result.stepMarks['q1'].calculationMark).toBe(1);
    expect(result.stepMarks['q1'].finalMark).toBe(1);
    expect(result.evaluatedAt).toBeDefined();
  });

  it('throws an error if no files are provided', async () => {
    await expect(evaluateHandwrittenWork([], sampleQuestions)).rejects.toThrow(
      'Please upload at least one image of your handwritten rough work.'
    );
  });

  it('throws on non-ok API status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'server fault' }), { status: 500 })
    );
    const file = new File(['fake'], 'paper.png', { type: 'image/png' });
    await expect(evaluateHandwrittenWork([file], sampleQuestions)).rejects.toThrow(
      'Failed to evaluate handwritten work: 500'
    );
  });

  it('throws if AI returns an empty response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: '' }] } }] }),
        { status: 200 }
      )
    );
    const file = new File(['fake'], 'paper.png', { type: 'image/png' });
    await expect(evaluateHandwrittenWork([file], sampleQuestions)).rejects.toThrow(
      'AI returned an empty evaluation'
    );
  });

  it('throws if AI returns malformed JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeGeminiResponse('not-valid-json'));
    const file = new File(['fake'], 'paper.png', { type: 'image/png' });
    await expect(evaluateHandwrittenWork([file], sampleQuestions)).rejects.toThrow(
      'Failed to parse AI evaluation of handwritten notes'
    );
  });
});

