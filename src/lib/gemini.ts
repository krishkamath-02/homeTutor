/**
 * Gemini Vision AI Service
 * Sends homework images to Gemini and returns structured MCQ questions.
 */

export type Difficulty = 'basic' | 'intermediate' | 'advanced';

export interface GeneratedQuestion {
    text: string;
    options: string[];
    correct_answer_index: number;
    explanation?: string;
    topic?: string;
    socratic_hint?: string;
    distractor_analysis?: Record<string, string>;
}

// Convert a File to a base64 data string (without the data: prefix)
export const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Strip the "data:image/jpeg;base64," prefix
            resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

export async function generateQuestionsFromImages(
    files: File[],
    subject: string,
    difficulty: Difficulty,
    customInstructions?: string,
    questionCount: number = 5,
    curriculumBoard: string = 'CBSE',
    gradeLevel: number = 5
): Promise<GeneratedQuestion[]> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API key is not configured.');

    // Build image parts for each uploaded file
    const imageParts = await Promise.all(
        files.map(async (file) => ({
            inlineData: {
                data: await fileToBase64(file),
                mimeType: file.type || 'image/jpeg',
            },
        }))
    );

    const difficultyInstruction = difficulty === 'basic'
        ? 'Generate EASY questions suitable for a young student. Questions should test basic recall and straightforward comprehension of the material shown.'
        : difficulty === 'intermediate'
            ? 'Generate BALANCED questions. Include a mix of recall and slightly more thoughtful questions that require understanding relationships between concepts.'
            : 'Generate ADVANCED, CHALLENGING questions. Include hypothetical, analytical, and application-based questions that require deeper reasoning beyond what is directly shown in the images.';

    const teacherContext = imageParts.length > 0
        ? `creating a diagnostic practice test from the provided homework images.`
        : `creating a diagnostic practice test based on specific curriculum requirements.`;

    const systemPrompt = `You are an expert ${subject} educator designing a pedagogical diagnostic assessment for a Grade ${gradeLevel} student following the ${curriculumBoard} curriculum.
${teacherContext}
${difficultyInstruction}
${imageParts.length > 0 ? '\nBase questions directly on concepts taught in the provided homework material.\n' : '\nBase questions strictly on the user instructions provided below.\n'}
${customInstructions ? `\nUSER SPECIFIC INSTRUCTIONS: ${customInstructions}\n` : ''}

PEDAGOGICAL REQUIREMENTS:
1. Avoid generic or silly distractors. Each incorrect option MUST represent an authentic student misconception (e.g. calculation error, sign mistake, conceptual inversion).
2. For every question, provide a "socratic_hint" that nudges the student to think independently without revealing the answer.
3. For every question, provide a "distractor_analysis" object mapping each incorrect option index (e.g. "1", "2", "3") to the specific misconception that caused that choice.

Respond with a JSON array of exactly ${questionCount} MCQ objects. 
Each object MUST contain:
- "text": string (the question statement formatted according to ${curriculumBoard} Grade ${gradeLevel} standards)
- "options": array of 4 distinct choices
- "correct_answer_index": integer (0 to 3)
- "socratic_hint": string (helpful guidance without revealing the answer)
- "distractor_analysis": object mapping incorrect option indices ("0", "1", "2", or "3" excluding the correct one) to the underlying misconception
- "explanation": string (step-by-step reasoning explaining why the correct choice is true)
- "topic": string (the specific curriculum topic/sub-topic tested)

Rules:
- Ensure all strings are properly escaped for JSON.
- Do not include any text outside the JSON array.`;

    const requestBody = {
        contents: [
            {
                parts: [
                    ...(imageParts.length > 0 ? imageParts : [{ text: "[No images provided - generating based on text instructions]" }]),
                    { text: systemPrompt },
                ],
            },
        ],
        generationConfig: {
            temperature: difficulty === 'basic' ? 0.3 : difficulty === 'intermediate' ? 0.5 : 0.8,
            maxOutputTokens: 2500,
            responseMimeType: "application/json",
        },
    };

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        }
    );

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 429) {
            throw new Error('AI Rate Limit Exceeded: You have used all your free AI credits for now. Please wait a minute and try again.');
        }
        if (response.status === 404) {
            throw new Error(`AI Model Error (404): The requested AI model was not found. Please verify your API key and region settings.`);
        }
        throw new Error(`Gemini API error: ${response.status} – ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!rawText) {
        throw new Error('AI returned an empty response. Please try again with clearer images.');
    }

    try {
        const questions: GeneratedQuestion[] = JSON.parse(rawText);
        if (!Array.isArray(questions)) throw new Error('Unexpected response format from Gemini');
        return questions;
    } catch (parseError) {
        console.error('Failed to parse Gemini JSON:', rawText);
        throw new Error(`Failed to read AI response. This usually happens with very complex images. Please try uploading fewer or clearer files.`);
    }
}

export async function evaluateHandwrittenWork(
    files: File[],
    questions: Array<{
        id: string;
        text: string;
        options: string[];
        correctAnswerIndex: number;
        explanation?: string;
    }>,
    studentAnswers?: Record<string, number>
): Promise<import('./supabase').RoughWorkEvaluation> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API key is not configured.');

    if (files.length === 0) {
        throw new Error('Please upload at least one image of your handwritten rough work.');
    }

    const imageParts = await Promise.all(
        files.map(async (file) => ({
            inlineData: {
                data: await fileToBase64(file),
                mimeType: file.type || 'image/jpeg',
            },
        }))
    );

    const questionsContext = questions.map((q, idx) => `
Question ${idx + 1} (ID: ${q.id}):
Statement: ${q.text}
Options: ${q.options.map((opt, i) => `(${i}) ${opt}`).join(', ')}
Correct Option: (${q.correctAnswerIndex}) ${q.options[q.correctAnswerIndex]}
Student Answer: ${studentAnswers && studentAnswers[q.id] !== undefined ? `(${studentAnswers[q.id]}) ${q.options[studentAnswers[q.id]]}` : 'Not provided'}
Explanation: ${q.explanation || 'N/A'}
`).join('\n');

    const systemPrompt = `You are an expert pedagogical grader and teacher evaluating a student's handwritten rough work / scratch paper.
The student worked through the following test questions on paper:
${questionsContext}

YOUR MISSION:
Carefully inspect the handwritten calculations and scribbles in the uploaded images. Match each handwritten section to the corresponding question.

EVALUATION RUBRIC FOR EACH QUESTION:
1. "methodMark": integer (0 or 1) - Award 1 if the student identified the correct formula, theorem, or method setup.
2. "calculationMark": integer (0 or 1) - Award 1 if intermediate algebraic/arithmetic calculations are free of arithmetic/sign errors. If 0, specify the exact error.
3. "finalMark": integer (0 or 1) - Award 1 if the intermediate steps lead correctly to the final answer.
4. "maxMarks": integer (typically 3: 1 method + 1 calculation + 1 final answer).
5. "transcribedSteps": array of strings transcribing the student's handwritten lines line-by-line.
6. "stepFeedback": string with encouraging, specific guidance explaining what went right and where the student made a mistake.
7. "identifiedErrorType": string or null (e.g. "Arithmetic sign error", "Inverted fraction", "Formula recall error", or null if correct).

Return a JSON object with this exact structure:
{
  "transcribedSummary": "A concise 2-sentence summary of what the student wrote across their working paper",
  "overallFeedback": "Positive teacher coaching feedback praising their effort and highlighting 1 key learning habit",
  "accuracyScore": 85,
  "stepMarks": {
    "<question_id>": {
      "questionNumber": 1,
      "questionId": "<question_id>",
      "methodMark": 1,
      "calculationMark": 0,
      "finalMark": 0,
      "maxMarks": 3,
      "transcribedSteps": ["Step 1: ...", "Step 2: ..."],
      "stepFeedback": "...",
      "identifiedErrorType": "..."
    }
  }
}

Do not include any text outside the JSON object.`;

    const requestBody = {
        contents: [
            {
                parts: [
                    ...imageParts,
                    { text: systemPrompt },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 3000,
            responseMimeType: "application/json",
        },
    };

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        }
    );

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Failed to evaluate handwritten work: ${response.status} – ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!rawText) {
        throw new Error('AI returned an empty evaluation. Please make sure the handwriting is clearly visible.');
    }

    try {
        const evaluation: import('./supabase').RoughWorkEvaluation = JSON.parse(rawText);
        evaluation.evaluatedAt = new Date().toISOString();
        return evaluation;
    } catch (parseError) {
        console.error('Failed to parse rough work evaluation JSON:', rawText);
        throw new Error('Failed to parse AI evaluation of handwritten notes. Please try with a clearer photo.');
    }
}

/**
 * Automatically inspects an uploaded homework/worksheet image to detect the subject.
 */
export async function detectSubjectFromImage(file: File): Promise<string | null> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
        const base64Data = await fileToBase64(file);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

        const payload = {
            contents: [
                {
                    parts: [
                        {
                            inline_data: {
                                mime_type: file.type || 'image/jpeg',
                                data: base64Data,
                            },
                        },
                        {
                            text: 'Analyze this educational homework/worksheet photo. Which academic subject does it belong to? Choose the single best match from: Math, Science, Physics, Chemistry, Biology, English, Hindi, Social Studies, History, Geography, Computer Science, Economics. Return ONLY the single subject name and nothing else.',
                        },
                    ],
                },
            ],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 20,
            },
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) return null;
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!rawText) return null;

        const cleaned = rawText.replace(/[^a-zA-Z\s]/g, '').trim();
        if (cleaned.toLowerCase() === 'mathematics') return 'Math';
        return cleaned || null;
    } catch (err) {
        console.warn('AI subject detection error:', err);
        return null;
    }
}

