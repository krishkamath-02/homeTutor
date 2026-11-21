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

export const PRIMARY_GEMINI_MODEL = 'gemini-3.1-flash-lite';
export const FALLBACK_GEMINI_MODELS = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
];

/**
 * Strips markdown code blocks (e.g. ```json ... ```) and parses JSON cleanly.
 */
export function cleanAndParseJson<T = any>(rawText: string): T {
    if (!rawText || !rawText.trim()) {
        throw new Error('Empty response from AI model');
    }
    const clean = rawText
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    return JSON.parse(clean);
}

/**
 * Resilient Gemini API caller that uses the active fast model and falls back
 * across candidate models if 503 (high demand) or 404 occurs.
 */
export async function callGeminiApi(
    apiKey: string,
    payload: any,
    preferredModel: string = PRIMARY_GEMINI_MODEL
): Promise<{ text: string; modelUsed: string }> {
    const modelsToTry = [preferredModel, ...FALLBACK_GEMINI_MODELS.filter(m => m !== preferredModel)];
    let lastError: Error | null = null;

    for (let i = 0; i < modelsToTry.length; i++) {
        const model = modelsToTry[i];
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.status === 429) {
                throw new Error('Rate Limit Exceeded: You have used all your free AI credits for now. Please wait a minute and try again.');
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const errMsg = JSON.stringify(err);
                if (res.status === 503 && i < modelsToTry.length - 1) {
                    console.warn(`Model ${model} returned 503. Trying fallback model ${modelsToTry[i + 1]}...`);
                    lastError = new Error(`Model ${model} error: 503 – ${errMsg}`);
                    continue;
                }
                if (res.status === 404) {
                    throw new Error(`AI Model Error (404): The requested AI model was not found. Please verify your API key and region settings.`);
                }
                throw new Error(`Gemini API error: ${res.status} – ${errMsg}`);
            }

            const data = await res.json();
            const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            return { text, modelUsed: model };
        } catch (err: any) {
            if (err.message?.startsWith('Model ') && err.message?.includes('error: 503')) {
                lastError = err;
                continue;
            }
            throw err;
        }
    }

    throw lastError || new Error('All candidate AI models failed to respond.');
}

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

    const { text: rawText } = await callGeminiApi(apiKey, requestBody);

    if (!rawText) {
        throw new Error('AI returned an empty response. Please try again with clearer images.');
    }

    try {
        const questions: GeneratedQuestion[] = cleanAndParseJson<GeneratedQuestion[]>(rawText);
        if (!Array.isArray(questions)) throw new Error('Unexpected response format from Gemini');
        return questions;
    } catch (parseError: any) {
        if (parseError.message?.includes('Empty response')) throw parseError;
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

    let rawText = '';
    try {
        const result = await callGeminiApi(apiKey, requestBody);
        rawText = result.text;
    } catch (apiErr: any) {
        const statusMatch = apiErr.message?.match(/(\d{3})/);
        const status = statusMatch ? statusMatch[1] : '';
        throw new Error(`Failed to evaluate handwritten work: ${status || apiErr.message}`);
    }

    if (!rawText) {
        throw new Error('AI returned an empty evaluation. Please make sure the handwriting is clearly visible.');
    }

    try {
        const evaluation: import('./supabase').RoughWorkEvaluation = cleanAndParseJson<import('./supabase').RoughWorkEvaluation>(rawText);
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

        const { text: rawText } = await callGeminiApi(apiKey, payload);
        if (!rawText) return null;

        const cleaned = rawText.replace(/[^a-zA-Z\s]/g, '').trim();
        if (cleaned.toLowerCase() === 'mathematics') return 'Math';
        return cleaned || null;
    } catch (err) {
        console.warn('AI subject detection error:', err);
        return null;
    }
}

export interface HomeworkVerificationResult {
    isComplete: boolean;
    completenessScore: number;
    summary: string;
    feedback: string;
    coachingFeedback: string;
    completedQuestions: string[];
    missingOrIncompleteQuestions: string[];
    missingQuestions: string[];
    status: 'verified_complete' | 'needs_revision';
    accuracyNotes: string;
    evaluatedAt: string;
}

/**
 * Verifies a student's completed handwritten notebook pages against the original
 * teacher homework assigned via WhatsApp, MS Teams, or school app.
 */
export async function verifyDailyHomework(
    assignmentImageFiles: File[],
    studentSubmissionFiles: File[],
    subject: string,
    assignmentTitle: string,
    description?: string
): Promise<HomeworkVerificationResult> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (studentSubmissionFiles.length === 0) {
        throw new Error('Please upload at least one photo of the completed notebook or worksheet.');
    }

    if (!apiKey) {
        throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY.');
    }

    // Filter valid files (size > 0)
    const validAssignmentFiles = assignmentImageFiles.filter(f => f && f.size > 0);
    const validStudentFiles = studentSubmissionFiles.filter(f => f && f.size > 0);

    if (validStudentFiles.length === 0) {
        throw new Error('Student submission photos appear to be empty or corrupted. Please upload valid photos.');
    }

    const assignmentParts = await Promise.all(
        validAssignmentFiles.map(async (file) => ({
            inlineData: {
                data: await fileToBase64(file),
                mimeType: file.type || 'image/jpeg',
            },
        }))
    );

    const studentParts = await Promise.all(
        validStudentFiles.map(async (file) => ({
            inlineData: {
                data: await fileToBase64(file),
                mimeType: file.type || 'image/jpeg',
            },
        }))
    );

    const prompt = `You are an expert school teacher reviewing and verifying a student's completed written homework against the original homework sheet assigned by the teacher (e.g. sent via WhatsApp or Teams).

ACADEMIC CONTEXT:
- Subject: ${subject}
- Assignment Title / Chapter: ${assignmentTitle}
- Additional Teacher Instructions: ${description || 'None provided'}

IMAGES PROVIDED:
- ${assignmentParts.length > 0 ? `The first ${assignmentParts.length} image(s) show the ORIGINAL SCHOOL HOMEWORK assignment.` : 'No original assignment photo was attached; inspect the student work against the title and instructions.'}
- The following ${studentParts.length} image(s) show the STUDENT'S COMPLETED NOTEBOOK PAGES.

YOUR VERIFICATION GOAL:
1. Identify all questions, exercises, or tasks indicated in the teacher's original assignment (or title).
2. Carefully inspect the student's handwritten notebook pages to verify if those tasks were solved and written out.
3. Calculate a completeness percentage from 0 to 100. If completeness >= 80%, set "isComplete": true; otherwise false.
4. List the questions verified as completed, and any omitted/incomplete items.
5. Provide warm, encouraging teacher feedback on presentation, handwriting, and accuracy.

Respond strictly with valid JSON matching this schema:
{
  "isComplete": true,
  "completenessScore": 95,
  "summary": "Brief 1-2 sentence verification summary",
  "feedback": "Encouraging teacher coaching remarks",
  "completedQuestions": ["Question/Exercise 1 completed", "Question/Exercise 2 with steps"],
  "missingOrIncompleteQuestions": [],
  "accuracyNotes": "Calculations and key concepts are correct"
}`;

    const payload = {
        contents: [
            {
                parts: [
                    ...assignmentParts,
                    ...studentParts,
                    { text: prompt }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
        }
    };

    const { text: rawJson } = await callGeminiApi(apiKey, payload);
    const parsed = cleanAndParseJson<any>(rawJson);
    const isComplete = Boolean(parsed.isComplete);
    const score = Number(parsed.completenessScore) || (isComplete ? 90 : 50);
    const feedbackText = parsed.feedback || parsed.summary || 'Work has been reviewed.';
    const missing = Array.isArray(parsed.missingOrIncompleteQuestions) ? parsed.missingOrIncompleteQuestions : [];

    return {
        isComplete,
        completenessScore: score,
        summary: parsed.summary || 'Homework verified.',
        feedback: feedbackText,
        coachingFeedback: feedbackText,
        completedQuestions: Array.isArray(parsed.completedQuestions) ? parsed.completedQuestions : [],
        missingOrIncompleteQuestions: missing,
        missingQuestions: missing,
        status: isComplete ? 'verified_complete' : 'needs_revision',
        accuracyNotes: parsed.accuracyNotes || 'Method verified.',
        evaluatedAt: new Date().toISOString()
    };
}

export interface ExtractedTeamsTask {
    id: string;
    subject: string;
    task: string;
    dueDate: string;
    reminderRule: '1_day_before' | '2_days_before' | 'same_morning';
    isTestOrDictation: boolean;
    hasCorrectionsNotice: boolean;
    requiredFilesPrompt?: string;
}

export interface ExtractedTeamsPost {
    greeting?: string;
    date: string;
    gradeClass: string;
    tasks: ExtractedTeamsTask[];
    generalNotices: string[];
    rawText?: string;
}

/**
 * Extracts homework tasks, due dates, test/dictation notices, and instructions
 * from a Microsoft Teams screenshot or message text (Grade 2 Class II A homeroom).
 */
export async function extractTeamsPost(
    screenshotFile?: File | null,
    manualText?: string
): Promise<ExtractedTeamsPost> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your environment.');
    }

    if (!screenshotFile && !manualText?.trim()) {
        throw new Error('Please select an image or enter message text to extract homework.');
    }

    const parts: any[] = [];
    if (screenshotFile && screenshotFile.size > 0) {
        parts.push({
            inlineData: {
                data: await fileToBase64(screenshotFile),
                mimeType: screenshotFile.type || 'image/jpeg'
            }
        });
    }

    const promptText = `You are an expert AI teaching assistant reading homework notices, diary entries, WhatsApp messages, or Microsoft Teams post screenshots sent by school teachers.

CAREFULLY PERFORM OPTICAL CHARACTER RECOGNITION (OCR) ON THE IMAGE / TEXT PROVIDED.
Extract all homework tasks, due dates, test dates, and teacher notices.

For each subject or task found:
- "id": a unique string (e.g. "task-1", "task-2")
- "subject": academic subject (e.g. "Math", "English", "Science", "Hindi", "Social Studies", "EVS", "Art", "General")
- "task": the exact task, chapter, exercise, page numbers, or questions assigned
- "dueDate": due date or day mentioned (e.g. "Tomorrow", "Today", "Monday", specific date, or "Next class")
- "reminderRule": "1_day_before" | "2_days_before" | "same_morning" (use "2_days_before" for tests, "same_morning" if due tomorrow)
- "isTestOrDictation": true if it mentions a test, exam, dictation, quiz, assessment, unit test, or spelling check
- "hasCorrectionsNotice": true if it mentions doing test corrections, signature required, or error correction
- "requiredFilesPrompt": recommended next step for parent (e.g. for English: "Upload English chapter pages to build spelling list"; for Math homework: "Upload completed notebook to check answers"; for test corrections: "Upload marked test paper")

Also extract:
- "greeting": opening greeting if present
- "date": date of the notice or today's date (YYYY-MM-DD)
- "gradeClass": grade or class mentioned (e.g. "Grade 2 · Class II A") or "Class Work / Homework"
- "generalNotices": list of any non-subject reminders (e.g. "Bring color pencils tomorrow", "Sign the school almanac", "Sports day practice")

If the image does not contain readable homework, return "tasks": [] and state what was observed in "generalNotices".

Respond strictly with valid JSON matching this schema:
{
  "greeting": "string",
  "date": "YYYY-MM-DD",
  "gradeClass": "string",
  "tasks": [
    {
      "id": "task-1",
      "subject": "Math",
      "task": "string",
      "dueDate": "string",
      "reminderRule": "1_day_before",
      "isTestOrDictation": false,
      "hasCorrectionsNotice": false,
      "requiredFilesPrompt": "string"
    }
  ],
  "generalNotices": ["string"]
}
${manualText ? `\nADDITIONAL MESSAGE TEXT:\n${manualText}` : ''}`;

    parts.push({ text: promptText });

    const payload = {
        contents: [{ parts }],
        generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
        }
    };

    const { text: rawJson } = await callGeminiApi(apiKey, payload);
    const parsed = cleanAndParseJson<any>(rawJson);

    const tasks: ExtractedTeamsTask[] = Array.isArray(parsed.tasks) ? parsed.tasks.map((t: any, idx: number) => ({
        id: t.id || `task-${Date.now()}-${idx}`,
        subject: t.subject || 'General',
        task: t.task || 'Review homework',
        dueDate: t.dueDate || 'Tomorrow',
        reminderRule: (t.reminderRule === '2_days_before' || t.reminderRule === 'same_morning') ? t.reminderRule : '1_day_before',
        isTestOrDictation: Boolean(t.isTestOrDictation),
        hasCorrectionsNotice: Boolean(t.hasCorrectionsNotice),
        requiredFilesPrompt: t.requiredFilesPrompt || 'Upload notebook pages to verify'
    })) : [];

    const generalNotices: string[] = Array.isArray(parsed.generalNotices) ? parsed.generalNotices : [];
    if (tasks.length === 0 && generalNotices.length === 0) {
        generalNotices.push('Could not detect readable homework tasks from this image. Please check image clarity and try again.');
    }

    return {
        greeting: parsed.greeting || 'Teacher Homework Update',
        date: parsed.date || new Date().toISOString().split('T')[0],
        gradeClass: parsed.gradeClass || 'School Homework',
        tasks,
        generalNotices,
        rawText: manualText || 'Extracted from uploaded screenshot'
    };
}

export interface SpellingWord {
    word: string;
    syllables: string;
    meaning: string;
    exampleSentence: string;
    phoneticTip?: string;
}

export interface SpellingListResult {
    chapterTitle: string;
    subject: string;
    words: SpellingWord[];
    generatedAt: string;
}

/**
 * Generates an adaptive Grade 2 spelling and vocabulary list from English chapter pages.
 */
export async function generateSpellingList(
    chapterFiles: File[],
    chapterTitle: string = 'English Chapter'
): Promise<SpellingListResult> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    const demoFallback: SpellingListResult = {
        chapterTitle: chapterTitle || "The Friendly Whale (Chapter 4)",
        subject: "English",
        generatedAt: new Date().toISOString(),
        words: [
            {
                word: "Friendly",
                syllables: "Friend • ly",
                meaning: "Acting like a good friend; kind and pleasant",
                exampleSentence: "The dolphin was very friendly and swam near our boat.",
                phoneticTip: "The 'ie' makes a short 'eh' sound like in 'bed'."
            },
            {
                word: "Ocean",
                syllables: "O • cean",
                meaning: "A very large sea of salt water",
                exampleSentence: "Whales live in the deep blue ocean.",
                phoneticTip: "'ce' sounds like 'sh' in this word."
            },
            {
                word: "Breathe",
                syllables: "Breathe (1 syllable)",
                meaning: "To take air in and out of the lungs",
                exampleSentence: "A whale must swim to the surface to breathe air.",
                phoneticTip: "The silent 'e' at the end makes 'ea' say 'ee'."
            },
            {
                word: "Surface",
                syllables: "Sur • face",
                meaning: "The top or outside layer of something",
                exampleSentence: "Water splashed as the whale reached the surface.",
                phoneticTip: "The ending '-face' sounds like 'fiss'."
            },
            {
                word: "Gentle",
                syllables: "Gen • tle",
                meaning: "Calm, kind and not rough",
                exampleSentence: "The giant creature was gentle with the little fish.",
                phoneticTip: "Soft 'g' sounds like 'j'."
            },
            {
                word: "Splash",
                syllables: "Splash (1 syllable)",
                meaning: "To scatter liquid in drops with a loud sound",
                exampleSentence: "The whale made a big splash with its tail.",
                phoneticTip: "Three consonant blend 'spl-' at the start."
            },
            {
                word: "Enormous",
                syllables: "E • nor • mous",
                meaning: "Extremely large; huge",
                exampleSentence: "Blue whales are enormous animals.",
                phoneticTip: "Accent is on the middle syllable 'NOR'."
            },
            {
                word: "Journey",
                syllables: "Jour • ney",
                meaning: "Traveling from one place to another",
                exampleSentence: "The sea turtles started their long journey home.",
                phoneticTip: "'our' sounds like 'er'."
            }
        ]
    };

    if (!apiKey || chapterFiles.length === 0) {
        await new Promise(r => setTimeout(r, 1200));
        return demoFallback;
    }

    try {
        const imageParts = await Promise.all(
            chapterFiles.map(async file => ({
                inlineData: {
                    data: await fileToBase64(file),
                    mimeType: file.type || 'image/jpeg'
                }
            }))
        );

        const prompt = `You are a Grade 2 English primary teacher.
From the provided English textbook / chapter pages, extract 8 to 10 key spelling and vocabulary words suitable for Grade 2 students (7-8 years old).
For each word provide:
- "word": capitalized spelling word
- "syllables": syllable breakdown with middle dots (e.g. "Friend • ly")
- "meaning": simple, 1-sentence child-friendly definition
- "exampleSentence": simple Grade 2 sentence using the word
- "phoneticTip": phonetic rule or pronunciation tip to help the child memorize spelling

Respond strictly with a JSON object:
{
  "chapterTitle": "${chapterTitle}",
  "subject": "English",
  "words": [
    {
      "word": "string",
      "syllables": "string",
      "meaning": "string",
      "exampleSentence": "string",
      "phoneticTip": "string"
    }
  ]
}`;

        const payload = {
            contents: [{ parts: [...imageParts, { text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                responseMimeType: "application/json"
            }
        };

        const { text: rawJson } = await callGeminiApi(apiKey, payload);
        if (!rawJson) throw new Error('Empty response from AI model');

        const parsed = cleanAndParseJson<any>(rawJson);
        return {
            chapterTitle: parsed.chapterTitle || chapterTitle,
            subject: "English",
            words: Array.isArray(parsed.words) && parsed.words.length > 0 ? parsed.words : [],
            generatedAt: new Date().toISOString()
        };
    } catch (err: any) {
        console.error('Spelling list generation error:', err);
        throw new Error(err.message || 'Failed to generate spelling list from uploaded chapter pages.');
    }
}

export interface MarkedTestCorrectionItem {
    questionNumber: string;
    originalQuestion: string;
    childMistake: string;
    correctSolution: string;
    learningTip: string;
    topic: string;
}

export interface MarkedTestAnalysisResult {
    totalMarks: number;
    marksObtained: number;
    percentage: number;
    subject: string;
    weakTopics: string[];
    strongTopics: string[];
    corrections: MarkedTestCorrectionItem[];
    recommendedDifficulty: 'basic' | 'intermediate' | 'advanced';
    teacherCoachingSummary: string;
    evaluatedAt: string;
}

/**
 * Analyzes a marked test paper uploaded by the parent when the teacher says "do corrections".
 * Identifies score, marked red-pen mistakes, weak topics, and guided correction steps.
 */
export async function analyzeMarkedTest(
    markedFiles: File[],
    subject: string = 'Math'
): Promise<MarkedTestAnalysisResult> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY.');
    }

    if (markedFiles.length === 0) {
        throw new Error('Please upload at least one photo of the marked test paper.');
    }

    try {
        const imageParts = await Promise.all(
            markedFiles.map(async file => ({
                inlineData: {
                    data: await fileToBase64(file),
                    mimeType: file.type || 'image/jpeg'
                }
            }))
        );

        const prompt = `You are an expert primary school educator inspecting a teacher-marked test paper for a Grade 2 student.
Examine the teacher's red-pen marks, scores, and circled errors.
1. Extract total marks and marks obtained (if not explicit, estimate from visible question marks).
2. Calculate percentage.
3. If percentage >= 85%, recommendedDifficulty is 'advanced'; if between 70-84%, 'intermediate'; if < 70%, 'basic'.
4. Identify weak topics where points were lost.
5. Identify strong topics answered correctly.
6. For each incorrect question, provide step-by-step corrections with:
   - questionNumber
   - originalQuestion
   - childMistake (exact misconception/calculation slip)
   - correctSolution (clear, step-by-step child-friendly walkthrough)
   - learningTip (memorable mnemonic or rule)
   - topic

Respond strictly in JSON matching this schema:
{
  "totalMarks": 25,
  "marksObtained": 19,
  "percentage": 76,
  "subject": "${subject}",
  "weakTopics": ["string"],
  "strongTopics": ["string"],
  "recommendedDifficulty": "basic | intermediate | advanced",
  "teacherCoachingSummary": "string",
  "corrections": [
    {
      "questionNumber": "Q3",
      "originalQuestion": "string",
      "childMistake": "string",
      "correctSolution": "string",
      "learningTip": "string",
      "topic": "string"
    }
  ]
}`;

        const payload = {
            contents: [{ parts: [...imageParts, { text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json"
            }
        };

        const { text: rawJson } = await callGeminiApi(apiKey, payload);
        if (!rawJson) throw new Error('Empty response from AI model');

        const parsed = cleanAndParseJson<any>(rawJson);
        const marks = Number(parsed.marksObtained) || 0;
        const total = Number(parsed.totalMarks) || (marks > 0 ? marks : 20);
        const pct = total > 0 ? Math.round((marks / total) * 100) : 75;

        return {
            totalMarks: total,
            marksObtained: marks,
            percentage: pct,
            subject: parsed.subject || subject,
            weakTopics: Array.isArray(parsed.weakTopics) ? parsed.weakTopics : [],
            strongTopics: Array.isArray(parsed.strongTopics) ? parsed.strongTopics : [],
            recommendedDifficulty: pct >= 85 ? 'advanced' : pct >= 70 ? 'intermediate' : 'basic',
            teacherCoachingSummary: parsed.teacherCoachingSummary || 'Marked test paper reviewed.',
            corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
            evaluatedAt: new Date().toISOString()
        };
    } catch (err: any) {
        console.error('Marked test analysis error:', err);
        throw new Error(err.message || 'Failed to analyze marked test paper.');
    }
}

/**
 * Reads a textbook page or worksheet to extract the exact problems, questions,
 * and exercise content to turn a brief plan entry into an actual, complete homework.
 */
export async function extractContentFromHomeworkPage(
    file: File,
    subject: string,
    taskTitle: string
): Promise<string> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API key is not configured.');

    const base64Data = await fileToBase64(file);
    const prompt = `You are a primary school teacher digitizing a homework worksheet or textbook page for ${subject} ("${taskTitle}").
Read all the questions, exercises, problem statements, and instructions visible on this page.
Transcribe and organize them clearly so the student and parent have the exact questions:
- List each question or exercise clearly (e.g. Q1, Q2, Question 3).
- Include any numerical problems, word problems, or sentences to complete.
- Keep the transcription clean, readable, and child-friendly.
Do not invent questions not present on the page.`;

    const payload = {
        contents: [
            {
                parts: [
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: file.type || 'image/jpeg'
                        }
                    },
                    { text: prompt }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1500
        }
    };

    const { text } = await callGeminiApi(apiKey, payload);
    return text.trim();
}


