import { NextRequest, NextResponse } from "next/server";
import {
  ANALYZE_SYSTEM_PROMPT,
  normalizeAnalyzeResult,
  parseModelJson,
  truncateCode,
  type AnalyzeProjectInput,
  type AnalyzeProjectResult,
} from "@/lib/analyzeProject";
import { reverseEngineerProject } from "@/lib/reverseEngineer";

export const runtime = "nodejs";

const DEFAULT_MODEL = "claude-sonnet-4-6";

function textFromAnthropicContent(content: unknown) {
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const row = block as { type?: string; text?: string };
      return row.type === "text" ? row.text || "" : "";
    })
    .join("\n")
    .trim();
}

function fallbackName(filename?: string) {
  return (
    filename?.split("/").pop()?.replace(/\.[^.]+$/, "") || "untitled project"
  );
}

async function anthropicAnalyze(
  input: AnalyzeProjectInput,
): Promise<AnalyzeProjectResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  const code = truncateCode(input.code || "");

  const userPrompt = [
    "Produce the JSON project post draft from this upload.",
    "Abstract the project seriously and precisely. Return only valid JSON.",
    "",
    `filename: ${input.filename || "code"}`,
    `folder: ${input.folderHint || "none"}`,
    `related projects: ${(input.relatedTitles || []).join(", ") || "none"}`,
    `social title: ${input.socialTitle || "none"}`,
    `social description: ${input.socialDescription || "none"}`,
    "",
    "CODE:",
    code.trim()
      ? code
      : "(no code provided — use social context only if present)",
  ].join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.2,
      system: ANALYZE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `anthropic error ${response.status}: ${errText.slice(0, 400)}`,
    );
  }

  const payload = (await response.json()) as { content?: unknown };
  const normalized = normalizeAnalyzeResult(
    parseModelJson(textFromAnthropicContent(payload.content)),
    fallbackName(input.filename),
  );
  if (!normalized) {
    throw new Error("could not normalize model output");
  }
  return { ...normalized, source: "ai" };
}

function parseBody(body: AnalyzeProjectInput): AnalyzeProjectInput {
  return {
    code: typeof body.code === "string" ? body.code : "",
    filename: body.filename,
    folderHint: body.folderHint,
    relatedTitles: Array.isArray(body.relatedTitles)
      ? body.relatedTitles.filter((t): t is string => typeof t === "string")
      : [],
    socialTitle: body.socialTitle,
    socialDescription: body.socialDescription,
  };
}

export async function POST(request: NextRequest) {
  let body: AnalyzeProjectInput;
  try {
    body = (await request.json()) as AnalyzeProjectInput;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const input = parseBody(body);

  try {
    const ai = await anthropicAnalyze(input);
    if (ai) return NextResponse.json(ai);
  } catch (error) {
    console.error("[analyze-project]", error);
  }

  return NextResponse.json({
    ...reverseEngineerProject(input),
    source: process.env.ANTHROPIC_API_KEY
      ? "heuristic-fallback"
      : "heuristic",
  } satisfies AnalyzeProjectResult);
}
