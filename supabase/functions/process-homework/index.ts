/// <reference path="../deno.d.ts" />

// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code runs securely on Supabase Edge Functions (Deno runtime).
// The Gemini API key is accessed securely via Deno.env.get('GEMINI_API_KEY'), never exposed to clients.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HomeworkAnalysisRequest {
  homeworkId: string;
  files?: Array<{ base64Data: string; mimeType: string }>;
  subject?: string;
  difficulty?: "basic" | "intermediate" | "advanced";
  customInstructions?: string;
  activityType?: "practice" | "assignment" | "quiz" | "test";
  questionCount?: number;
  curriculumBoard?: string;
  gradeLevel?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured in Supabase Edge Secrets.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user with Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce subscription quota / daily test limit
    const { data: limitCheck } = await supabase.rpc(
      "check_and_record_test_generation",
      { p_user_id: user.id }
    );

    if (limitCheck && limitCheck.allowed === false) {
      return new Response(JSON.stringify({
        error: limitCheck.message || "Daily free test limit reached. Please upgrade to Pro for unlimited tests.",
        code: "DAILY_LIMIT_REACHED",
        tier: limitCheck.tier,
        daily_limit: limitCheck.daily_limit,
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: HomeworkAnalysisRequest = await req.json();
    const {
      homeworkId,
      files = [],
      subject = "General",
      difficulty = "intermediate",
      customInstructions = "",
      activityType = "quiz",
      questionCount = 5,
      curriculumBoard = "CBSE",
      gradeLevel = 5,
    } = body;

    // Stage 1: Analyze homework content and extract concepts
    const analysisPrompt = `You are an expert ${subject} educator for ${curriculumBoard} Grade ${gradeLevel}.
Analyze the provided homework material thoroughly.
Return a clean JSON object with:
- "subject": string (detected or confirmed subject)
- "gradeLevel": string (estimated grade or age group)
- "topics": array of strings (core curriculum topics found)
- "concepts": array of strings (key concepts, formulas, or vocabulary tested)
- "summary": string (concise 2-sentence summary of the homework)
- "difficulty": "basic" | "intermediate" | "advanced"
- "learningObjectives": array of strings (what the student needs to master)`;

    const imageParts = files.map((f) => ({
      inlineData: {
        data: f.base64Data,
        mimeType: f.mimeType,
      },
    }));

    const stage1Response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                ...imageParts,
                { text: analysisPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!stage1Response.ok) {
      const errText = await stage1Response.text();
      throw new Error(`Gemini Analysis Error (${stage1Response.status}): ${errText}`);
    }

    const stage1Data = await stage1Response.json();
    const analysisJsonText = stage1Data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const analysis = JSON.parse(analysisJsonText);

    // Stage 2: Generate diagnostic pedagogical questions
    const questionsPrompt = `You are an expert tutor creating a diagnostic ${difficulty} level ${activityType} for ${subject} for a Grade ${gradeLevel} student under the ${curriculumBoard} curriculum.
Based on the analyzed homework:
Topics: ${JSON.stringify(analysis.topics || [])}
Concepts: ${JSON.stringify(analysis.concepts || [])}
${customInstructions ? `User custom instructions: ${customInstructions}` : ""}

PEDAGOGICAL REQUIREMENTS:
1. Avoid generic or silly distractors. Each incorrect option MUST represent an authentic student misconception (e.g. calculation error, sign mistake, conceptual inversion).
2. For every question, provide a "socratic_hint" that nudges the student to think independently without revealing the answer.
3. For every question, provide a "distractor_analysis" object mapping each incorrect option index (e.g. "1", "2", "3") to the specific misconception that caused that choice.

Generate exactly ${questionCount} questions in JSON format.
Return a JSON array of objects, each containing:
- "text": string (the question statement aligned with ${curriculumBoard} Grade ${gradeLevel} standards)
- "options": array of 4 distinct choices
- "correct_answer_index": integer (0 to 3)
- "socratic_hint": string (guiding clue without revealing the answer)
- "distractor_analysis": object mapping incorrect option indices ("0", "1", "2", or "3" excluding the correct one) to the underlying misconception
- "explanation": string (step-by-step reasoning explaining why the answer is correct)
- "topic": string (the specific topic this question evaluates)
- "difficulty": "${difficulty}"`;

    const stage2Response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                ...imageParts,
                { text: questionsPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: difficulty === "basic" ? 0.3 : difficulty === "intermediate" ? 0.5 : 0.8,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!stage2Response.ok) {
      const errText = await stage2Response.text();
      throw new Error(`Gemini Question Generation Error (${stage2Response.status}): ${errText}`);
    }

    const stage2Data = await stage2Response.json();
    const questionsJsonText = stage2Data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const questions = JSON.parse(questionsJsonText);

    // Update homework row with extracted metadata if homeworkId provided
    if (homeworkId) {
      await supabase
        .from("homework")
        .update({
          extracted_topics: analysis.topics || [],
          extracted_concepts: analysis.concepts || [],
          raw_analysis: analysis,
          status: "analyzed",
        })
        .eq("id", homeworkId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        questions,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
