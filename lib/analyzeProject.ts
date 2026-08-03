import {
  amazonSearchUrl,
  hasPhysicalHardware,
  isHardwareMaterial,
  reverseEngineerProject,
  type MaterialGuess,
  type ReverseEngineerResult,
  type SchematicGuess,
  type StepGuess,
} from "@/lib/reverseEngineer";

export type AnalyzeProjectInput = {
  code: string;
  filename?: string;
  folderHint?: string;
  relatedTitles?: string[];
  socialTitle?: string;
  socialDescription?: string;
};

export type AnalyzeProjectResult = ReverseEngineerResult & {
  source?: "ai" | "heuristic" | "heuristic-fallback";
};

const MAX_CODE_CHARS = 40_000;

export const ANALYZE_SYSTEM_PROMPT = `You document real projects for Work Bench.

Input is project code (any language or stack) plus optional social context. Treat the code as primary evidence. Abstract what the project is and how to reproduce it. Do not invent parts, wiring, or steps the code does not support.

Tone: serious, plain, to the point. Lowercase. No hype, emoji, jokes, or filler.

Return ONLY valid JSON (no markdown fences):
{
  "projectName": "short factual title",
  "summary": "1–2 sentences: what it is and what it does",
  "materials": [
    {
      "id": "slug-id",
      "name": "physical part name",
      "note": "optional short qualifier",
      "evidence": "brief cite from the code",
      "buyUrl": "product or search url, or empty string"
    }
  ],
  "steps": [
    {
      "id": "slug-id",
      "title": "short imperative step",
      "details": ["concrete action", "optional second line"]
    }
  ],
  "schematic": null
}

If — and only if — the code shows physical electronics/wiring, set "schematic" to:
{
  "boardLabel": "main board or chip",
  "buttonPin": "pin or gpio, else empty",
  "ledPin": "pin or gpio, else empty",
  "hasOnboardMic": false,
  "pinMap": "wiring map from the code, or empty"
}

Rules:
- Domain-agnostic: firmware, apps, scripts, tools, mixed hardware/software — infer from the code, not assumptions.
- Abstract: name the system, its purpose, inputs/outputs, and the minimum path to run or build it.
- Prefer evidence in filenames, imports, pin defines, manifests, comments, and structure over guesses.
- Materials: physical hardware only when clearly implied. Otherwise []. Never list computers, IDEs, languages, frameworks, or packages as materials.
- Schematic: null unless real wiring/pins/boards appear in the code. Never invent a board diagram for software-only work.
- Steps: 5–10 practical steps a careful reader can follow. Software → install, configure, run, verify. Hardware → gather, wire/assemble, flash/power, test. No decorative steps.
- Social title/description may refine naming and summary; code wins for materials, schematic, and procedure.
- buyUrl: "" if unknown; a search URL is acceptable when the part name is solid.
- If code conflicts or is thin, stay conservative: shorter summary, fewer materials, honest steps.`;

export function truncateCode(code: string) {
  if (code.length <= MAX_CODE_CHARS) return code;
  return `${code.slice(0, MAX_CODE_CHARS)}\n\n/* …truncated… */`;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asBool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function slugId(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || fallback;
}

function normalizeMaterials(raw: unknown): MaterialGuess[] {
  if (!Array.isArray(raw)) return [];
  const out: MaterialGuess[] = [];
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = asString(row.name);
    if (!name) continue;
    const material: MaterialGuess = {
      id: asString(row.id) || slugId(name, `part-${index + 1}`),
      name: name.toLowerCase(),
      note: asString(row.note) || undefined,
      evidence: asString(row.evidence) || "from uploaded code",
      buyUrl: asString(row.buyUrl) || amazonSearchUrl(name),
    };
    if (!isHardwareMaterial(material)) continue;
    out.push(material);
  }
  return out;
}

function normalizeSteps(raw: unknown): StepGuess[] {
  if (!Array.isArray(raw)) return [];
  const out: StepGuess[] = [];
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = asString(row.title);
    if (!title) continue;
    const detailsRaw = row.details;
    const details = Array.isArray(detailsRaw)
      ? detailsRaw.map((line) => asString(line)).filter(Boolean)
      : asString(detailsRaw)
        ? [asString(detailsRaw)]
        : [""];
    out.push({
      id: asString(row.id) || slugId(title, `step-${index + 1}`),
      title: title.toLowerCase(),
      details: details.length ? details.map((d) => d.toLowerCase()) : [""],
    });
  }
  return out;
}

function normalizeSchematic(
  raw: unknown,
  materials: MaterialGuess[],
  projectName: string,
): SchematicGuess | null {
  if (!hasPhysicalHardware(materials)) return null;
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;

  const row = raw as Record<string, unknown>;
  const boardLabel =
    asString(row.boardLabel) ||
    materials.find((m) => /esp32|arduino|pico|stm32|nrf|board/i.test(m.name))
      ?.name ||
    projectName;

  return {
    boardLabel: boardLabel.toLowerCase() || "board",
    buttonPin: asString(row.buttonPin).toLowerCase() || "gpio",
    ledPin: asString(row.ledPin).toLowerCase() || "gpio",
    hasOnboardMic: asBool(row.hasOnboardMic, false),
    pinMap: asString(row.pinMap),
  };
}

export function normalizeAnalyzeResult(
  raw: unknown,
  fallbackName = "untitled project",
): ReverseEngineerResult | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const projectName =
    asString(row.projectName).toLowerCase() || fallbackName;
  const summary = asString(row.summary).toLowerCase();
  if (!summary && !asString(row.projectName)) return null;

  const materials = normalizeMaterials(row.materials);
  const steps = normalizeSteps(row.steps);
  const hardware = hasPhysicalHardware(materials);
  return {
    projectName,
    summary:
      summary ||
      (hardware
        ? `a ${projectName} build using ${materials
            .slice(0, 4)
            .map((m) => m.name)
            .join(", ")}.`
        : `a ${projectName} software project.`),
    materials: hardware ? materials : [],
    steps: steps.length
      ? steps
      : [
          {
            id: "start",
            title: "open the project files",
            details: [
              "read through the uploaded scripts and note how the project runs.",
            ],
          },
        ],
    schematic: hardware
      ? normalizeSchematic(row.schematic, materials, projectName)
      : null,
  };
}

export function parseModelJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("model did not return JSON");
  }
}

/** Call the analyze API. Server falls back to heuristics; this only catches network failures. */
export async function analyzeProject(
  input: AnalyzeProjectInput,
): Promise<AnalyzeProjectResult> {
  try {
    const response = await fetch("/api/analyze-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(`analyze failed (${response.status})`);
    }
    const data = (await response.json()) as AnalyzeProjectResult;
    if (!data?.projectName || !data?.summary) {
      throw new Error("invalid analyze response");
    }
    return data;
  } catch {
    return {
      ...reverseEngineerProject(input),
      source: "heuristic-fallback",
    };
  }
}
