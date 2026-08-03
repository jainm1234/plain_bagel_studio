"use client";

import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  amazonSearchUrl,
  type ReverseEngineerResult,
  type SchematicGuess,
} from "@/lib/reverseEngineer";
import { analyzeProject } from "@/lib/analyzeProject";
import { fetchSocialHints, socialPlatformLabel } from "@/lib/socialHints";
import {
  WORKBENCH_PROJECTS,
  mergeFeedProjects,
  searchWorkbenchProjects,
} from "@/lib/workbenchProjects";
import type { WorkbenchProject } from "@/components/WorkbenchFeed";
import { postIdFromHref } from "@/lib/workbenchReactions";
import WorkbenchSchematic from "@/components/WorkbenchSchematic";
import WorkbenchRichEditor, {
  buildProjectPostHtml,
  fileBasename,
  withSocialInPostHtml,
} from "@/components/WorkbenchRichEditor";
import WorkbenchProjectCover from "@/components/WorkbenchProjectCover";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";
import {
  openWorkbenchSubmit,
  postHref,
  savePostEdit,
  type WorkbenchPostDraft,
} from "@/lib/workbenchPostEdits";
import {
  snapWorkbenchImageWidth,
  WORKBENCH_IMAGE_SIZES,
} from "@/lib/workbenchImageSizes";
import {
  hostDataUrl,
  hostDataUrlsInHtml,
} from "@/lib/workbenchMediaUpload";

function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8",
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadHref(filename: string, href: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function filenameFromDataUrl(dataUrl: string, base: string) {
  const mime = dataUrl.match(/^data:([^;]+)/)?.[1] || "";
  const ext =
    mime === "image/jpeg"
      ? "jpg"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/gif"
          ? "gif"
          : mime === "image/svg+xml"
            ? "svg"
            : "png";
  return `${base}.${ext}`;
}

type PartItem = {
  id: string;
  name: string;
  note?: string;
  buyUrl: string;
};

type StepItem = {
  id: string;
  title: string;
  details: string[];
  imageUrl?: string | null;
  imageWidth?: number | null;
  imageCaption?: string | null;
  videoUrl?: string | null;
};

type RelatedProject = {
  title: string;
  href: string;
  authorHandle?: string;
};

type WizardStep =
  | "code"
  | "header"
  | "description"
  | "materials"
  | "howto"
  | "schematic"
  | "scripts"
  | "done";

type SchematicItem = {
  id: string;
  source: "generated" | "custom" | "upload";
  edited?: boolean;
  boardLabel: string;
  buttonPin: string;
  ledPin: string;
  hasOnboardMic: boolean;
  pinMap: string;
  imageUrl?: string | null;
};

function schematicFromGuess(
  guess: SchematicGuess,
  source: "generated" | "custom" = "generated",
  id?: string,
): SchematicItem {
  return {
    id: id || `${source}:${Date.now()}`,
    source,
    edited: false,
    boardLabel: guess.boardLabel,
    buttonPin: guess.buttonPin,
    ledPin: guess.ledPin,
    hasOnboardMic: guess.hasOnboardMic,
    pinMap: guess.pinMap,
    imageUrl: null,
  };
}

function toParts(result: ReverseEngineerResult): PartItem[] {
  return result.materials.map((m) => ({
    id: m.id,
    name: m.name,
    note: m.note,
    buyUrl: m.buyUrl,
  }));
}

function toSteps(result: ReverseEngineerResult): StepItem[] {
  return result.steps.map((s) => ({
    id: s.id,
    title: s.title,
    details: s.details.length ? s.details : [""],
  }));
}

type UploadedFile = {
  path: string;
  content: string;
};

function scriptEntries(files: UploadedFile[], paste: string) {
  const entries = files.map((file) => ({
    name: file.path,
    content: file.content,
  }));
  if (paste.trim()) {
    entries.push({ name: "pasted-code.txt", content: paste });
  }
  return entries;
}

const CODE_EXT =
  /\.(ino|py|cpp|cc|cxx|c|h|hpp|hxx|txt|js|jsx|ts|tsx|mjs|cjs|rs|go|java|kt|swift|m|mm|rb|php|cs|lua|sh|bash|zsh|cmake|mk|makefile|md|json|toml|yml|yaml|cfg|ini|s|asm|v|sv|vhd|vhdl|html|css|scss|sql|r|ipynb|plist|gradle|xml)$/i;

const SKIP_PATH =
  /(^|\/)(node_modules|\.git|\.svn|\.hg|dist|build|\.next|__pycache__|\.venv|venv|target|\.DS_Store)(\/|$)/i;

const STEP_ORDER: WizardStep[] = [
  "code",
  "header",
  "description",
  "materials",
  "howto",
  "schematic",
  "scripts",
  "done",
];

const STEPPER_STEPS: WizardStep[] = [
  "code",
  "header",
  "description",
  "materials",
  "howto",
  "schematic",
  "scripts",
];

/** Steps shown in the preview wizard (after code upload). */
const PREVIEW_STEPS: WizardStep[] = [
  "header",
  "description",
  "materials",
  "howto",
  "schematic",
  "scripts",
];

const STEP_LABEL: Record<WizardStep, string> = {
  code: "code",
  header: "header",
  description: "description",
  materials: "materials",
  howto: "steps",
  schematic: "schematic",
  scripts: "scripts",
  done: "done",
};

const STEP_TITLE: Record<WizardStep, string> = {
  code: "Add project code",
  header: "Project header",
  description: "Description",
  materials: "Materials",
  howto: "Steps",
  schematic: "Schematic",
  scripts: "Scripts",
  done: "Project submitted",
};

const STEP_BLURB: Record<WizardStep, string> = {
  code: "Upload files or paste code. Optional social link or a work bench project this references.",
  header: "Title, subtitle, social link, and cover.",
  description: "Write what the project is. Changes show in the preview.",
  materials: "Optional — skip if you don't need a parts list.",
  howto: "Optional — skip if you don't need build steps.",
  schematic: "Optional — upload a schematic image, or skip.",
  scripts: "Review or add scripts before submitting.",
  done: "Your project was sent.",
};

function isCodeFile(path: string, file?: File) {
  const name = path.split("/").pop() || path;
  if (SKIP_PATH.test(path)) return false;
  if (CODE_EXT.test(name)) return true;
  if (/^(makefile|dockerfile|cmakelists\.txt)$/i.test(name)) return true;
  if (
    file &&
    file.size > 0 &&
    file.size < 1_500_000 &&
    (!file.type ||
      file.type.startsWith("text/") ||
      /json|javascript|typescript|python|xml|yaml|toml|shellscript|x-sh/i.test(
        file.type,
      ))
  ) {
    return true;
  }
  return false;
}

function filePath(file: File) {
  return (
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name
  );
}

async function readCodeFiles(fileList: FileList | File[]) {
  const files = Array.from(fileList).filter((file) =>
    isCodeFile(filePath(file), file),
  );
  const loaded: UploadedFile[] = [];
  for (const file of files) {
    try {
      const content = await file.text();
      loaded.push({ path: filePath(file), content });
    } catch {
      // skip unreadable files
    }
  }
  return loaded;
}

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath?: string;
  file?: (
    success: (file: File) => void,
    error?: (err: Error) => void,
  ) => void;
  createReader?: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (err: Error) => void,
    ) => void;
  };
};

function hasFileDrag(types: readonly string[] | DOMStringList) {
  const list = Array.from(types as ArrayLike<string>);
  return list.includes("Files") || list.includes("files");
}

async function readAllDirectoryEntries(
  reader: NonNullable<FileSystemEntryLike["createReader"]> extends () => infer R
    ? R
    : never,
): Promise<FileSystemEntryLike[]> {
  const entries: FileSystemEntryLike[] = [];
  while (true) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (!batch.length) break;
    entries.push(...batch);
  }
  return entries;
}

async function collectFilesFromEntry(
  entry: FileSystemEntryLike,
  prefix = "",
): Promise<File[]> {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name;

  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file!(resolve, reject);
    });
    if (!isCodeFile(path)) return [];
    Object.defineProperty(file, "webkitRelativePath", {
      configurable: true,
      value: path.startsWith("/") ? path.slice(1) : path,
    });
    return [file];
  }

  if (entry.isDirectory && entry.createReader) {
    if (SKIP_PATH.test(`${path}/`)) return [];
    const reader = entry.createReader();
    const children = await readAllDirectoryEntries(reader);
    const nested = await Promise.all(
      children.map((child) => collectFilesFromEntry(child, path)),
    );
    return nested.flat();
  }

  return [];
}

async function filesFromDataTransfer(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items || []);
  if (items.length) {
    const entries = items
      .map((item) => {
        const entry =
          (
            item as DataTransferItem & {
              webkitGetAsEntry?: () => FileSystemEntryLike | null;
            }
          ).webkitGetAsEntry?.() || null;
        return entry;
      })
      .filter(Boolean) as FileSystemEntryLike[];

    if (entries.length) {
      const nested = await Promise.all(
        entries.map((entry) => collectFilesFromEntry(entry)),
      );
      const files = nested.flat();
      if (files.length) return files;
    }
  }

  return Array.from(dataTransfer.files || []);
}

function combineFiles(files: UploadedFile[], paste: string) {
  const parts = files.map(
    (file) => `// ===== ${file.path} =====\n${file.content.trimEnd()}`,
  );
  if (paste.trim()) {
    parts.push(`// ===== pasted =====\n${paste.trimEnd()}`);
  }
  return parts.join("\n\n");
}

function folderHintFromFiles(files: UploadedFile[]) {
  if (!files.length) return "";
  const first = files[0].path;
  if (!first.includes("/")) return "";
  return first.split("/")[0];
}

function sourceLabelFromFiles(files: UploadedFile[], paste: string) {
  if (files.length > 1) return `${files.length} files`;
  if (files[0]?.path) return files[0].path;
  if (paste.trim()) return "pasted code";
  return "code";
}

type DocSnapshot = {
  projectName: string;
  socialLink: string;
  related: RelatedProject[];
  lead: string;
  postHtml: string;
  coverImage: string | null;
  parts: PartItem[];
  steps: StepItem[];
  schematics: SchematicItem[];
};

const EMPTY_DOC: DocSnapshot = {
  projectName: "",
  socialLink: "",
  related: [],
  lead: "",
  postHtml: "",
  coverImage: null,
  parts: [],
  steps: [],
  schematics: [],
};

const MAX_HISTORY = 80;

function cloneDoc(snapshot: DocSnapshot): DocSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as DocSnapshot;
}

function docsEqual(a: DocSnapshot, b: DocSnapshot) {
  return JSON.stringify(a) === JSON.stringify(b);
}

type Props = {
  variant?: "link" | "widget" | "host";
};

export default function SubmitProjectFlow({ variant = "link" }: Props) {
  const { user, openLogin } = useWorkbenchAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>("code");
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const [related, setRelated] = useState<RelatedProject[]>([]);
  const [relatedQuery, setRelatedQuery] = useState("");
  const [projectCatalog, setProjectCatalog] =
    useState<WorkbenchProject[]>(WORKBENCH_PROJECTS);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [paste, setPaste] = useState("");
  const [result, setResult] = useState<ReverseEngineerResult | null>(null);
  const [parts, setParts] = useState<PartItem[]>([]);
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [schematics, setSchematics] = useState<SchematicItem[]>([]);
  const [lead, setLead] = useState("");
  const [postHtml, setPostHtml] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);

  const historyRef = useRef<DocSnapshot[]>([cloneDoc(EMPTY_DOC)]);
  const historyIndexRef = useRef(0);
  const skipHistoryRef = useRef(false);
  const pendingSubmitRef = useRef(false);
  const editBaselineRef = useRef<{
    doc: DocSnapshot;
    files: UploadedFile[];
    paste: string;
  } | null>(null);
  const schematicUploadRef = useRef<HTMLInputElement | null>(null);
  const scriptUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/posts");
        const data = (await response.json()) as {
          posts?: WorkbenchProject[];
        };
        if (cancelled) return;
        setProjectCatalog(
          mergeFeedProjects(
            WORKBENCH_PROJECTS,
            data.posts || [],
            postIdFromHref,
          ),
        );
      } catch {
        if (!cancelled) setProjectCatalog(WORKBENCH_PROJECTS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/analyze-project");
        const data = (await response.json()) as { aiReady?: boolean };
        if (!cancelled) setAiReady(Boolean(data.aiReady));
      } catch {
        if (!cancelled) setAiReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const code = useMemo(() => combineFiles(files, paste), [files, paste]);

  function currentDoc(): DocSnapshot {
    return {
      projectName,
      socialLink,
      related,
      lead,
      postHtml,
      coverImage,
      parts,
      steps,
      schematics,
    };
  }

  function hasEditChanges() {
    const baseline = editBaselineRef.current;
    if (!editPostId || !baseline) return false;
    if (!docsEqual(currentDoc(), baseline.doc)) return true;
    if (paste !== baseline.paste) return true;
    return JSON.stringify(files) !== JSON.stringify(baseline.files);
  }

  function applyDoc(snapshot: DocSnapshot) {
    skipHistoryRef.current = true;
    setProjectName(snapshot.projectName);
    setSocialLink(snapshot.socialLink);
    setRelated(snapshot.related);
    setLead(snapshot.lead);
    setPostHtml(snapshot.postHtml);
    setCoverImage(snapshot.coverImage ?? null);
    setParts(snapshot.parts);
    setSteps(snapshot.steps);
    setSchematics(snapshot.schematics);
    setResult((current) => {
      if (current) {
        return {
          ...current,
          projectName: snapshot.projectName || current.projectName,
          summary: snapshot.lead || snapshot.postHtml,
        };
      }
      if (
        !snapshot.projectName &&
        !snapshot.lead &&
        !snapshot.postHtml &&
        !snapshot.parts.length &&
        !snapshot.steps.length
      ) {
        return null;
      }
      return {
        projectName: snapshot.projectName || "untitled project",
        summary: snapshot.lead,
        materials: [],
        steps: [],
        schematic: null,
      };
    });
    window.setTimeout(() => {
      skipHistoryRef.current = false;
    }, 0);
  }

  function resetHistory(snapshot: DocSnapshot = EMPTY_DOC) {
    historyRef.current = [cloneDoc(snapshot)];
    historyIndexRef.current = 0;
    setHistoryVersion((value) => value + 1);
  }

  function recordHistory(snapshot = currentDoc()) {
    if (skipHistoryRef.current) return;
    const stack = historyRef.current;
    const index = historyIndexRef.current;
    const present = stack[index];
    if (present && docsEqual(present, snapshot)) return;

    const next = [...stack.slice(0, index + 1), cloneDoc(snapshot)];
    while (next.length > MAX_HISTORY) next.shift();
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    setHistoryVersion((value) => value + 1);
  }

  function undo() {
    const present = currentDoc();
    const at = historyRef.current[historyIndexRef.current];
    if (!at || !docsEqual(at, present)) {
      recordHistory(present);
    }
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    applyDoc(historyRef.current[historyIndexRef.current]);
    setHistoryVersion((value) => value + 1);
  }

  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    applyDoc(historyRef.current[historyIndexRef.current]);
    setHistoryVersion((value) => value + 1);
  }

  const presentForHistory = currentDoc();
  const stackedPresent = historyRef.current[historyIndexRef.current];
  const canUndo =
    historyIndexRef.current > 0 ||
    Boolean(stackedPresent && !docsEqual(stackedPresent, presentForHistory));
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;
  void historyVersion;

  function syncGeneratedSchematic(guess: SchematicGuess | null) {
    setSchematics((current) => {
      const uploads = current.filter((item) => item.source === "upload");
      const existing = current.find((item) => item.source === "generated");
      if (!guess || !guess.boardLabel.trim()) {
        // Software-only / no hardware — drop auto schematic, keep uploads.
        return uploads;
      }
      if (existing?.edited) return current;
      const next = schematicFromGuess(
        guess,
        "generated",
        existing?.id || "generated",
      );
      if (existing) {
        return current.map((item) =>
          item.id === existing.id ? next : item,
        );
      }
      return [next, ...uploads];
    });
  }

  function applyAnalysis(
    parsed: ReverseEngineerResult,
    options: { replaceParts?: boolean; social?: string } = {},
  ) {
    const replaceParts = options.replaceParts !== false;
    const social = options.social ?? socialLink;
    const title = (parsed.projectName || projectName || "untitled project").trim();
    setProjectName(title);
    setResult(parsed);
    setLead(parsed.summary);
    if (replaceParts) {
      setParts(toParts(parsed));
      setSteps(toSteps(parsed));
      syncGeneratedSchematic(parsed.schematic);
    }
    setPostHtml(
      buildProjectPostHtml({
        social,
        summary: parsed.summary,
        description: parsed.description || parsed.summary,
      }),
    );
  }

  async function runAnalyze(input: {
    socialTitle?: string;
    socialDescription?: string;
  } = {}) {
    const namingFile =
      folderHintFromFiles(files) ||
      files[0]?.path ||
      sourceLabelFromFiles(files, paste);
    return analyzeProject({
      code,
      filename: namingFile,
      folderHint: folderHintFromFiles(files),
      relatedTitles: related.map((project) => project.title),
      socialTitle: input.socialTitle,
      socialDescription: input.socialDescription,
    });
  }

  useEffect(() => {
    if (!open || skipHistoryRef.current) return;
    const timer = window.setTimeout(() => {
      recordHistory();
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    projectName,
    socialLink,
    related,
    lead,
    postHtml,
    coverImage,
    parts,
    steps,
    schematics,
  ]);

  const fileSummary = useMemo(() => {
    if (!files.length) return "";
    if (files.length === 1) return files[0].path;
    return `${files.length} files`;
  }, [files]);

  const relatedSuggestions = useMemo(
    () =>
      searchWorkbenchProjects(
        relatedQuery,
        related.map((project) => project.href),
        projectCatalog,
      ),
    [relatedQuery, related, projectCatalog],
  );

  const stepIndex = STEP_ORDER.indexOf(step);

  function reset() {
    setStep("code");
    setEditPostId(null);
    editBaselineRef.current = null;
    setProjectName("");
    setSocialLink("");
    setRelated([]);
    setRelatedQuery("");
    setFiles([]);
    setPaste("");
    setResult(null);
    setParts([]);
    setSteps([]);
    setSchematics([]);
    setLead("");
    setPostHtml("");
    setCoverImage(null);
    setAnalyzing(false);
    setDraftError(null);
    setDraggingFiles(false);
    resetHistory(EMPTY_DOC);
  }

  function openFlow() {
    reset();
    setOpen(true);
  }

  function closeFlow() {
    pendingSubmitRef.current = false;
    setOpen(false);
    reset();
  }

  function loadEditDraft(draft: WorkbenchPostDraft) {
    const snapshot: DocSnapshot = {
      projectName: draft.projectName,
      socialLink: draft.socialLink,
      related: (draft.related || []).map((item) => ({
        title: item.title,
        href: item.href,
        authorHandle: item.authorHandle,
      })),
      lead: draft.lead,
      postHtml: draft.postHtml,
      coverImage: draft.coverImage ?? null,
      parts: draft.parts.map((part) => ({
        id: part.id,
        name: part.name,
        note: part.note,
        buyUrl: part.buyUrl,
      })),
      steps: draft.steps.map((stepItem) => ({
        id: stepItem.id,
        title: stepItem.title,
        details: stepItem.details.length ? stepItem.details : [""],
        imageUrl: stepItem.imageUrl ?? null,
        imageWidth: stepItem.imageWidth ?? 100,
        imageCaption: stepItem.imageCaption ?? "",
        videoUrl: stepItem.videoUrl ?? null,
      })),
      schematics: draft.schematics.map((item) => ({
        id: item.id,
        source: item.source,
        edited: item.edited,
        boardLabel: item.boardLabel,
        buttonPin: item.buttonPin,
        ledPin: item.ledPin,
        hasOnboardMic: item.hasOnboardMic,
        pinMap: item.pinMap,
        imageUrl: item.imageUrl ?? null,
      })),
    };
    setEditPostId(draft.postId);
    const loadedFiles = draft.files.map((file) => ({
      path: file.path,
      content: file.content,
    }));
    setFiles(loadedFiles);
    setPaste("");
    setRelated(
      (draft.related || []).map((item) => ({
        title: item.title,
        href: item.href,
        authorHandle: item.authorHandle,
      })),
    );
    setRelatedQuery("");
    setResult({
      projectName: draft.projectName || "untitled project",
      summary: draft.lead || draft.postHtml,
      materials: [],
      steps: [],
      schematic: null,
    });
    applyDoc(snapshot);
    resetHistory(snapshot);
    editBaselineRef.current = {
      doc: cloneDoc(snapshot),
      files: loadedFiles.map((file) => ({ ...file })),
      paste: "",
    };
    setStep("header");
    setOpen(true);
  }

  function buildDraft(postId: string): WorkbenchPostDraft {
    return {
      postId,
      projectName: projectName.trim() || "untitled project",
      lead,
      postHtml,
      socialLink,
      coverImage,
      parts: parts.map((part) => ({
        id: part.id,
        name: part.name,
        note: part.note,
        buyUrl: part.buyUrl,
      })),
      steps: steps.map((item) => ({
        id: item.id,
        title: item.title,
        details: item.details,
        imageUrl: item.imageUrl ?? null,
        imageWidth: item.imageWidth ?? 100,
        imageCaption: item.imageCaption ?? "",
        videoUrl: item.videoUrl ?? null,
      })),
      schematics: schematics.map((item) => ({
        id: item.id,
        source: item.source,
        edited: item.edited,
        boardLabel: item.boardLabel,
        buttonPin: item.buttonPin,
        ledPin: item.ledPin,
        hasOnboardMic: item.hasOnboardMic,
        pinMap: item.pinMap,
        imageUrl: item.imageUrl ?? null,
      })),
      files: scriptEntries(files, paste).map((script) => ({
        path: script.name,
        content: script.content,
      })),
      related: related.map((item) => ({
        title: item.title,
        href: item.href,
        authorHandle: item.authorHandle,
      })),
    };
  }

  async function prepareDraftForApi(
    draft: WorkbenchPostDraft,
  ): Promise<WorkbenchPostDraft> {
    const coverImage = await hostDataUrl(draft.coverImage, "covers");
    const postHtml = await hostDataUrlsInHtml(draft.postHtml);
    const steps = await Promise.all(
      draft.steps.map(async (step) => ({
        ...step,
        imageUrl: await hostDataUrl(step.imageUrl, "steps"),
        videoUrl: await hostDataUrl(step.videoUrl, "steps"),
      })),
    );
    const schematics = await Promise.all(
      draft.schematics.map(async (item) => ({
        ...item,
        imageUrl: await hostDataUrl(item.imageUrl, "schematics"),
      })),
    );

    return {
      ...draft,
      coverImage,
      postHtml,
      steps,
      schematics,
    };
  }

  async function persistDraftToApi(
    draft: WorkbenchPostDraft,
    mode: "create" | "update",
  ) {
    const prepared = await prepareDraftForApi(draft);
    const payload = {
      postId: prepared.postId !== "new" ? prepared.postId : undefined,
      projectName: prepared.projectName,
      lead: prepared.lead,
      postHtml: prepared.postHtml,
      socialLink: prepared.socialLink,
      coverImage: prepared.coverImage ?? null,
      parts: prepared.parts,
      steps: prepared.steps,
      schematics: prepared.schematics,
      files: prepared.files,
    };

    const body = JSON.stringify(payload);
    if (body.length > 4_000_000) {
      throw new Error(
        "Post is too large to save. Remove large images/videos from the description or steps and try again.",
      );
    }

    const url =
      mode === "update"
        ? `/api/posts/${encodeURIComponent(prepared.postId)}`
        : "/api/posts";
    const response = await fetch(url, {
      method: mode === "update" ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      post?: { href?: string };
      draft?: { id?: string };
    };

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error(
          "Post is too large to save. Remove large images/videos and try again.",
        );
      }
      throw new Error(data.error || `Could not ${mode} post (${response.status})`);
    }

    return { ...data, prepared };
  }

  async function saveEdit() {
    if (!editPostId || !hasEditChanges()) return;
    if (!user) {
      pendingSubmitRef.current = true;
      openLogin("log in to save your edits");
      return;
    }
    pendingSubmitRef.current = false;
    const draft = buildDraft(editPostId);
    setDraftError(null);
    setAnalyzing(true);
    try {
      let prepared = draft;
      try {
        const result = await persistDraftToApi(draft, "update");
        prepared = result.prepared;
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        // Seeded posts (e.g. note-taker) may not exist in Supabase yet.
        if (/not found|404/i.test(message)) {
          const result = await persistDraftToApi(draft, "create");
          prepared = result.prepared;
        } else if (/not configured|503/i.test(message)) {
          savePostEdit(draft);
          prepared = draft;
        } else {
          throw error;
        }
      }
      savePostEdit(prepared);
      window.dispatchEvent(
        new CustomEvent("workbench-post-edited", {
          detail: { postId: editPostId },
        }),
      );
      closeFlow();
      // Ensure the open project page picks up Supabase changes.
      window.setTimeout(() => {
        window.location.reload();
      }, 50);
    } catch (error) {
      setDraftError(
        error instanceof Error ? error.message : "Could not save post",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function submitVerified() {
    if (!user) {
      pendingSubmitRef.current = true;
      openLogin("log in to submit your project");
      return;
    }
    pendingSubmitRef.current = false;

    const title =
      projectName.trim() ||
      related[0]?.title ||
      "untitled project";
    if (!projectName.trim()) setProjectName(title);
    if (!result) {
      setResult({
        projectName: title,
        summary: "",
        materials: [],
        steps: [],
        schematic: null,
      });
    }

    const draft = buildDraft("new");
    draft.projectName = title;
    setDraftError(null);
    setAnalyzing(true);
    try {
      const data = await persistDraftToApi(draft, "create");
      const savedId =
        data.draft?.id ||
        (data.post?.href ? data.post.href.split("/").pop() : "") ||
        "";
      if (savedId) {
        savePostEdit({ ...draft, postId: decodeURIComponent(savedId) });
      }
      setStep("done");
      window.setTimeout(() => {
        window.location.href =
          data.post?.href || postHref(decodeURIComponent(savedId));
      }, 400);
    } catch (error) {
      setDraftError(
        error instanceof Error
          ? error.message
          : "Could not submit project. Check Supabase setup.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  useEffect(() => {
    if (variant === "widget") return;
    function onOpen() {
      reset();
      setOpen(true);
    }
    function onEdit(event: Event) {
      const detail = (event as CustomEvent<WorkbenchPostDraft>).detail;
      if (!detail?.postId) return;
      loadEditDraft(detail);
    }
    window.addEventListener("workbench-open-submit", onOpen);
    window.addEventListener("workbench-edit-post", onEdit);
    return () => {
      window.removeEventListener("workbench-open-submit", onOpen);
      window.removeEventListener("workbench-edit-post", onEdit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeFlow();
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, historyVersion]);

  async function addFiles(fileList: FileList | File[] | null) {
    if (!fileList || (Array.isArray(fileList) ? !fileList.length : !fileList.length))
      return;
    const loaded = await readCodeFiles(fileList);
    if (!loaded.length) return;

    setFiles((current) => {
      const byPath = new Map(current.map((file) => [file.path, file]));
      for (const file of loaded) byPath.set(file.path, file);
      return Array.from(byPath.values()).sort((a, b) =>
        a.path.localeCompare(b.path),
      );
    });
  }

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    await addFiles(event.target.files);
    event.target.value = "";
  }

  function onDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (hasFileDrag(event.dataTransfer.types)) {
      setDraggingFiles(true);
    }
  }

  function onDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (hasFileDrag(event.dataTransfer.types)) {
      event.dataTransfer.dropEffect = "copy";
      setDraggingFiles(true);
    }
  }

  function onDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setDraggingFiles(false);
  }

  async function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDraggingFiles(false);
    const dropped = await filesFromDataTransfer(event.dataTransfer);
    await addFiles(dropped);
  }

  function removeFile(path: string) {
    setFiles((current) => current.filter((file) => file.path !== path));
  }

  function updateFile(path: string, patch: Partial<UploadedFile>) {
    setFiles((current) =>
      current.map((file) => {
        if (file.path !== path) return file;
        const next = { ...file, ...patch };
        if (patch.path !== undefined) {
          const name = patch.path.trim() || file.path;
          next.path = name;
        }
        return next;
      }),
    );
  }

  function removeScript(name: string) {
    if (name === "pasted-code.txt") {
      setPaste("");
      return;
    }
    removeFile(name);
  }

  function goBack() {
    if (editPostId && step === STEPPER_STEPS[0]) {
      closeFlow();
      return;
    }
    if (!editPostId && step === "code") return;
    if (step === "done") {
      setStep("scripts");
      return;
    }
    const index = STEPPER_STEPS.indexOf(
      step as (typeof STEPPER_STEPS)[number],
    );
    if (index > 0) setStep(STEPPER_STEPS[index - 1]);
  }

  function ensureDraft(name = projectName) {
    const title =
      name.trim() ||
      related[0]?.title ||
      "untitled project";

    if (!projectName.trim()) setProjectName(title);

    setResult((current) => {
      if (current) {
        return {
          ...current,
          projectName: title,
        };
      }
      return {
        projectName: title,
        summary: "",
        materials: [],
        steps: [],
        schematic: null,
      };
    });

    if (!postHtml.trim()) {
      setPostHtml(
        buildProjectPostHtml({
          social: socialLink,
          summary: lead,
        }),
      );
    }

    return title;
  }

  function addRelated(project: {
    title: string;
    href: string;
    author?: { handle: string };
  }) {
    setRelated((current) =>
      current.some((item) => item.href === project.href)
        ? current
        : [
            ...current,
            {
              title: project.title,
              href: project.href,
              authorHandle: project.author?.handle,
            },
          ],
    );
    setRelatedQuery("");
  }

  function removeRelated(href: string) {
    setRelated((current) => current.filter((item) => item.href !== href));
  }

  async function analyzeAndContinue() {
    const latestCode = combineFiles(files, paste).trim();
    if (!latestCode) {
      setDraftError("add code or files before creating a draft.");
      return;
    }

    setDraftError(null);
    setAnalyzing(true);
    setStep("header");
    try {
      const namingFile =
        folderHintFromFiles(files) ||
        files[0]?.path ||
        sourceLabelFromFiles(files, paste);
      const url = socialLink.trim();
      let socialTitle = "";
      let socialDescription = "";
      if (url) {
        const hints = await fetchSocialHints(url);
        socialTitle = hints.title;
        socialDescription = hints.description;
      }
      const parsed = await analyzeProject({
        code: latestCode,
        filename: namingFile,
        folderHint: folderHintFromFiles(files),
        relatedTitles: related.map((project) => project.title),
        socialTitle,
        socialDescription,
      });
      if (projectName.trim() && projectName !== "untitled project") {
        parsed.projectName = projectName.trim();
      }

      if (parsed.aiError === "missing_api_key" || parsed.source !== "ai") {
        setDraftError(
          parsed.aiError === "missing_api_key"
            ? "AI isn't configured yet. Put your Anthropic key in .env.local as ANTHROPIC_API_KEY, restart npm run dev, then try again."
            : parsed.aiError
              ? `AI draft failed: ${parsed.aiError}`
              : "AI draft failed. No placeholder draft was applied.",
        );
        setAiReady(parsed.aiError !== "missing_api_key");
        setStep("code");
        return;
      }

      applyAnalysis(parsed, { replaceParts: true, social: url });
    } catch (error) {
      setDraftError(
        error instanceof Error
          ? error.message
          : "could not create a draft from your code.",
      );
      setStep("code");
    } finally {
      setAnalyzing(false);
    }
  }

  async function enrichFromSocialAndContinue() {
    setAnalyzing(true);
    try {
      const url = socialLink.trim();
      let socialTitle = "";
      let socialDescription = "";
      if (url) {
        const hints = await fetchSocialHints(url);
        socialTitle = hints.title;
        socialDescription = hints.description;
      }

      const parsed = await runAnalyze({
        socialTitle,
        socialDescription,
      });

      if (projectName.trim() && projectName !== "untitled project") {
        parsed.projectName = projectName.trim();
      }

      const replaceParts = parts.length === 0 && steps.length === 0;
      const leadIsWeak =
        !lead.trim() ||
        /could not detect|add your code|add code or materials|flesh out/i.test(
          lead,
        );

      if (replaceParts || leadIsWeak) {
        applyAnalysis(parsed, { replaceParts, social: url });
      } else {
        setResult(parsed);
        setPostHtml((current) =>
          withSocialInPostHtml(
            current || buildProjectPostHtml({ summary: lead }),
            url,
          ),
        );
      }
    } finally {
      setAnalyzing(false);
      setStep("materials");
    }
  }

  function removePart(id: string) {
    setParts((current) => current.filter((part) => part.id !== id));
  }

  function removeStep(id: string) {
    setSteps((current) => current.filter((item) => item.id !== id));
  }

  function updateSchematic(id: string, patch: Partial<SchematicItem>) {
    setSchematics((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...patch, edited: true } : item,
      ),
    );
  }

  function removeSchematic(id: string) {
    setSchematics((current) => current.filter((item) => item.id !== id));
  }

  function onSchematicImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) return;
      setSchematics((current) => [
        ...current,
        {
          id: `upload:${Date.now()}`,
          source: "upload",
          edited: true,
          boardLabel: file.name,
          buttonPin: "gpio",
          ledPin: "gpio",
          hasOnboardMic: false,
          pinMap: "",
          imageUrl: dataUrl,
        },
      ]);
    };
    reader.readAsDataURL(file);
  }

  function onCoverImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) return;
      setCoverImage(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function onStepImageUpload(id: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) return;
      updateStep(id, {
        imageUrl: dataUrl,
        imageWidth: 100,
        imageCaption: "",
      });
    };
    reader.readAsDataURL(file);
  }

  function onStepVideoUpload(id: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("video/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) return;
      updateStep(id, { videoUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  }

  function updatePart(id: string, patch: Partial<PartItem>) {
    setParts((current) =>
      current.map((part) => {
        if (part.id !== id) return part;
        const next = { ...part, ...patch };
        if (
          patch.name !== undefined &&
          patch.name !== part.name &&
          patch.buyUrl === undefined
        ) {
          const wasAmazon =
            !part.buyUrl ||
            part.buyUrl.includes("amazon.") ||
            part.buyUrl.includes(encodeURIComponent(part.name));
          if (wasAmazon) {
            next.buyUrl = amazonSearchUrl(patch.name.trim() || part.name);
          }
        }
        return next;
      }),
    );
  }

  function updateStep(id: string, patch: Partial<StepItem>) {
    setSteps((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addBlankPart() {
    const id = `custom:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setParts((current) => [
      ...current,
      {
        id,
        name: "",
        note: "",
        buyUrl: "",
      },
    ]);
    window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-part-name="${id}"]`,
      );
      input?.focus();
    }, 0);
  }

  function addBlankStep() {
    const id = `step:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setSteps((current) => [
      ...current,
      { id, title: "", details: [""] },
    ]);
    window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-step-title="${id}"]`,
      );
      input?.focus();
    }, 0);
  }

  useEffect(() => {
    if (!user || !pendingSubmitRef.current || !open) return;
    pendingSubmitRef.current = false;
    if (editPostId) void saveEdit();
    else void submitVerified();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume once after login
  }, [user]);

  function triggerOpen() {
    if (variant === "widget" || variant === "host") {
      openWorkbenchSubmit();
      return;
    }
    openFlow();
  }

  function goNext() {
    if (step === "done") {
      closeFlow();
      return;
    }
    if (step === "code") {
      void analyzeAndContinue();
      return;
    }
    if (step === "scripts") {
      if (editPostId) void saveEdit();
      else void submitVerified();
      return;
    }
    const index = STEPPER_STEPS.indexOf(
      step as (typeof STEPPER_STEPS)[number],
    );
    if (index >= 0 && index < STEPPER_STEPS.length - 1) {
      setStep(STEPPER_STEPS[index + 1]);
    }
  }

  function goSaveEdit() {
    void saveEdit();
  }

  const canGoBack = step !== "code" || Boolean(editPostId);
  const editingPreview =
    Boolean(editPostId) &&
    PREVIEW_STEPS.includes(step as (typeof PREVIEW_STEPS)[number]);
  const isEditDirty = hasEditChanges();

  const nextLabel =
    step === "code"
      ? analyzing
        ? "drafting…"
        : "create a draft for me"
      : step === "scripts"
        ? editPostId
          ? analyzing
            ? "saving…"
            : "save"
          : "submit"
        : step === "done"
          ? "close"
          : analyzing
            ? "drafting…"
            : "next";

  const scriptList = scriptEntries(files, paste);
  const showMaterials = parts.length > 0 || step === "materials";
  const showHowto = steps.length > 0 || step === "howto";
  const showSchematic = schematics.length > 0 || step === "schematic";
  const showScripts = scriptList.length > 0 || step === "scripts";
  const showDescription =
    Boolean(postHtml.replace(/<[^>]+>/g, "").trim()) ||
    /<(img|video|figure)\b/i.test(postHtml) ||
    step === "description";
  const previewStepIndex = PREVIEW_STEPS.indexOf(
    step as (typeof PREVIEW_STEPS)[number],
  );

  function goToPreviewStep(next: (typeof PREVIEW_STEPS)[number]) {
    setStep(next);
  }

  const previewToc: Array<{
    label: string;
    target: (typeof PREVIEW_STEPS)[number];
  }> = [
    { label: "header", target: "header" },
    { label: "description", target: "description" },
    { label: "materials", target: "materials" },
    { label: "steps", target: "howto" },
    { label: "schematic", target: "schematic" },
    { label: "scripts", target: "scripts" },
  ];

  const documentPane = (
    <aside
      className="workbench-flow-pane workbench-flow-pane--preview"
      aria-label="Project post preview"
    >
      <div
        className={
          analyzing
            ? "workbench-preview-stage is-pulsing"
            : "workbench-preview-stage"
        }
      >
        <div className="workbench-doc workbench-doc--project workbench-project--draft workbench-project--preview-readonly">
          <header
            className={
              step === "header"
                ? "workbench-project-head is-active-step workbench-preview-jump"
                : "workbench-project-head workbench-preview-jump"
            }
            role="button"
            tabIndex={0}
            onClick={() => goToPreviewStep("header")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                goToPreviewStep("header");
              }
            }}
            aria-label="Edit header"
          >
            <WorkbenchProjectCover
              coverImage={coverImage}
              socialLink={socialLink}
              title="project cover"
              empty={!coverImage && !socialLink.trim()}
              onClick={(event) => event.stopPropagation()}
            />
            <h1 className="workbench-project-title">
              {projectName.trim() || "project title"}
              {user?.handle ? (
                <>
                  {" "}
                  <span className="workbench-project-by">by</span>{" "}
                  {user.handle}
                </>
              ) : null}
              {socialLink.trim() ? (
                <>
                  {" "}
                  <span className="workbench-project-by">on</span>{" "}
                  <a
                    className="workbench-project-social"
                    href={socialLink.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {socialPlatformLabel(socialLink)}
                  </a>
                </>
              ) : null}
            </h1>
            {lead.trim() ? (
              <p className="workbench-project-lead">{lead.trim()}</p>
            ) : (
              <p className="workbench-project-lead workbench-project-copy--muted">
                project subtitle
              </p>
            )}
            {related.length > 0 ? (
              <p className="workbench-project-related">
                <span className="workbench-project-by">references </span>
                {related.map((item, index) => (
                  <span key={item.href}>
                    {index > 0 ? ", " : null}
                    <a
                      className="workbench-project-social"
                      href={item.href}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {item.title}
                    </a>
                  </span>
                ))}
              </p>
            ) : null}
          </header>

          <nav className="workbench-project-toc" aria-label="Table of contents">
            {previewToc.map((item) => (
              <button
                key={item.label}
                type="button"
                className={
                  step === item.target
                    ? "workbench-preview-toc-btn is-current"
                    : "workbench-preview-toc-btn"
                }
                onClick={() => goToPreviewStep(item.target)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {showDescription ? (
            <section
              id="draft-description"
              className={
                step === "description"
                  ? "workbench-project-section is-active-step workbench-preview-jump"
                  : "workbench-project-section workbench-preview-jump"
              }
              role="button"
              tabIndex={0}
              onClick={() => goToPreviewStep("description")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  goToPreviewStep("description");
                }
              }}
              aria-label="Edit description"
            >
              <h2 className="workbench-project-heading">description</h2>
              {postHtml.replace(/<[^>]+>/g, "").trim() ||
              /<(img|video|figure)\b/i.test(postHtml) ? (
                <div
                  className="workbench-project-copy"
                  dangerouslySetInnerHTML={{ __html: postHtml }}
                />
              ) : (
                <p className="workbench-project-copy workbench-project-copy--muted">
                  description appears here
                </p>
              )}
            </section>
          ) : null}

          {showMaterials ? (
            <section
              id="draft-materials"
              className={
                step === "materials"
                  ? "workbench-project-section is-active-step workbench-preview-jump"
                  : "workbench-project-section workbench-preview-jump"
              }
              role="button"
              tabIndex={0}
              onClick={() => goToPreviewStep("materials")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  goToPreviewStep("materials");
                }
              }}
              aria-label="Edit materials"
            >
              <h2 className="workbench-project-heading">materials</h2>
              {parts.some((part) => part.name.trim()) ? (
                <div className="workbench-project-materials">
                  {parts
                    .filter((part) => part.name.trim())
                    .map((part) => {
                      const buyHref =
                        part.buyUrl.trim() || amazonSearchUrl(part.name);
                      return (
                        <div
                          key={part.id}
                          className="workbench-project-material"
                        >
                          <div className="workbench-project-material-copy">
                            <p className="workbench-project-material-name">
                              {part.name}
                            </p>
                            {part.note?.trim() ? (
                              <p className="workbench-project-material-note">
                                {part.note}
                              </p>
                            ) : null}
                          </div>
                          {buyHref ? (
                            <a
                              className="workbench-project-material-buy"
                              href={buyHref}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              buy
                            </a>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="workbench-project-copy workbench-project-copy--muted">
                  no materials yet
                </p>
              )}
            </section>
          ) : null}

          {showHowto ? (
            <section
              id="draft-steps"
              className={
                step === "howto"
                  ? "workbench-project-section is-active-step workbench-preview-jump"
                  : "workbench-project-section workbench-preview-jump"
              }
              role="button"
              tabIndex={0}
              onClick={() => goToPreviewStep("howto")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  goToPreviewStep("howto");
                }
              }}
              aria-label="Edit steps"
            >
              <h2 className="workbench-project-heading">steps</h2>
              {steps.some(
                (item) =>
                  item.title.trim() ||
                  item.details.some((detail) => detail.trim()) ||
                  item.imageUrl ||
                  item.videoUrl,
              ) ? (
                <ol className="workbench-project-steps">
                  {steps.map((item, index) => (
                    <li key={item.id} className="workbench-project-step">
                      <span className="workbench-project-step-num">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3 className="workbench-project-step-title">
                          {item.title.trim() || "step"}
                        </h3>
                        {item.imageUrl ? (
                          <figure
                            className="workbench-figure workbench-step-figure"
                            style={{
                              width: `${snapWorkbenchImageWidth(item.imageWidth ?? 100)}%`,
                            }}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              className="workbench-step-image"
                              src={item.imageUrl}
                              alt=""
                            />
                            {item.imageCaption?.trim() ? (
                              <figcaption className="workbench-figure-caption">
                                {item.imageCaption.trim()}
                              </figcaption>
                            ) : null}
                          </figure>
                        ) : null}
                        {item.videoUrl ? (
                          <video
                            className="workbench-step-video"
                            src={item.videoUrl}
                            controls
                            playsInline
                            onClick={(event) => event.stopPropagation()}
                          />
                        ) : null}
                        <ul className="workbench-project-step-details">
                          {item.details
                            .filter((detail) => detail.trim())
                            .map((detail) => (
                              <li key={detail}>{detail}</li>
                            ))}
                        </ul>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="workbench-project-copy workbench-project-copy--muted">
                  no steps yet
                </p>
              )}
            </section>
          ) : null}

          {showSchematic ? (
            <section
              id="draft-schematic"
              className={
                step === "schematic"
                  ? "workbench-project-section is-active-step workbench-preview-jump"
                  : "workbench-project-section workbench-preview-jump"
              }
              role="button"
              tabIndex={0}
              onClick={() => goToPreviewStep("schematic")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  goToPreviewStep("schematic");
                }
              }}
              aria-label="Edit schematic"
            >
              <h2 className="workbench-project-heading">schematic</h2>
              {schematics.length > 0 ? (
                <div className="workbench-schematic-list">
                  {schematics.map((item, index) => (
                    <div key={item.id} className="workbench-schematic-card">
                      {item.boardLabel.trim() ? (
                        <h3 className="workbench-project-subheading">
                          {item.boardLabel}
                        </h3>
                      ) : null}
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="workbench-schematic-upload"
                          src={item.imageUrl}
                          alt={`Schematic ${index + 1}`}
                        />
                      ) : (
                        <WorkbenchSchematic
                          boardLabel={item.boardLabel}
                          buttonPin={item.buttonPin}
                          ledPin={item.ledPin}
                          hasOnboardMic={item.hasOnboardMic}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="workbench-project-copy workbench-project-copy--muted">
                  no schematic yet
                </p>
              )}
            </section>
          ) : null}

          {showScripts ? (
            <section
              id="draft-scripts"
              className={
                step === "scripts"
                  ? "workbench-project-section is-active-step workbench-preview-jump"
                  : "workbench-project-section workbench-preview-jump"
              }
              role="button"
              tabIndex={0}
              onClick={() => goToPreviewStep("scripts")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  goToPreviewStep("scripts");
                }
              }}
              aria-label="Edit scripts"
            >
              <h2 className="workbench-project-heading">scripts</h2>
              {scriptList.length > 0 ? (
                scriptList.map((script, index) => {
                  const name = fileBasename(script.name);
                  return (
                    <div
                      key={`${script.name}:${index}`}
                      className="workbench-project-script"
                    >
                      <div className="workbench-project-script-head">
                        <h3 className="workbench-project-subheading">
                          <span className="workbench-project-step-num">
                            {String(index + 1).padStart(2, "0")} ·{" "}
                          </span>
                          {name}
                        </h3>
                      </div>
                      <pre className="workbench-project-pre">
                        {script.content}
                      </pre>
                    </div>
                  );
                })
              ) : (
                <p className="workbench-project-copy workbench-project-copy--muted">
                  no scripts yet
                </p>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </aside>
  );

  const formPane = (
    <section className="workbench-flow-pane workbench-flow-pane--form">
      <div className="workbench-flow-sidebar-top">
        <div className="workbench-flow-sidebar-copy">
          <h2
            className={
              analyzing
                ? "workbench-flow-title is-pulsing"
                : "workbench-flow-title"
            }
          >
            {analyzing ? "Drafting…" : STEP_TITLE[step]}
          </h2>
          <p className="workbench-flow-blurb">
            {analyzing
              ? "Building your draft from the code."
              : STEP_BLURB[step]}
          </p>
        </div>
        {step !== "code" ? (
          <button
            type="button"
            className="workbench-flow-close"
            onClick={closeFlow}
            aria-label="Close"
          >
            ×
          </button>
        ) : null}
      </div>

      <div className="workbench-flow-sidebar-body">
        {step === "code" ? (
          <form
            className={
              draggingFiles
                ? "workbench-flow-form is-dragging-files"
                : "workbench-flow-form"
            }
            onSubmit={(event) => {
              event.preventDefault();
              goNext();
            }}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="workbench-dropzone-actions">
              <label className="workbench-submit-button workbench-submit-button--ghost">
                choose files
                <input
                  type="file"
                  multiple
                  className="workbench-sr-only"
                  onChange={onFiles}
                />
              </label>
              <label className="workbench-submit-button workbench-submit-button--ghost">
                choose folder
                <input
                  type="file"
                  className="workbench-sr-only"
                  // @ts-expect-error webkitdirectory is non-standard
                  webkitdirectory=""
                  multiple
                  onChange={onFiles}
                />
              </label>
            </div>
            {files.length > 0 ? (
              <ul className="workbench-file-list">
                {files.map((file) => (
                  <li key={file.path}>
                    <span>{file.path}</span>
                    <button
                      type="button"
                      className="workbench-file-remove"
                      onClick={() => removeFile(file.path)}
                      aria-label={`Remove ${file.path}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <textarea
              className="workbench-submit-textarea"
              rows={10}
              placeholder="paste code"
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              aria-label="Paste code"
            />
            <label className="workbench-flow-field">
              <span className="workbench-flow-field-label">
                Social link (optional)
              </span>
              <input
                className="workbench-submit-input"
                type="url"
                placeholder="https://…"
                value={socialLink}
                onChange={(event) => setSocialLink(event.target.value)}
                aria-label="Social media link"
              />
            </label>
            <div className="workbench-flow-field">
              <span className="workbench-flow-field-label">
                References a work bench project (optional)
              </span>
              <p className="workbench-flow-hint">
                Link a project already on the site that this builds on.
              </p>
              {related.length > 0 ? (
                <ul className="workbench-related-picked">
                  {related.map((item) => (
                    <li key={item.href}>
                      <span>
                        {item.title}
                        {item.authorHandle ? (
                          <span className="workbench-related-by">
                            {" "}
                            by {item.authorHandle}
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        className="workbench-doc-remove"
                        onClick={() => removeRelated(item.href)}
                        aria-label={`Remove ${item.title}`}
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <input
                className="workbench-submit-input"
                type="search"
                placeholder="search work bench…"
                value={relatedQuery}
                onChange={(event) => setRelatedQuery(event.target.value)}
                aria-label="Search work bench projects to reference"
                autoComplete="off"
              />
              {relatedSuggestions.length > 0 ? (
                <ul
                  className="workbench-related-suggestions"
                  role="listbox"
                  aria-label="Work bench projects"
                >
                  {relatedSuggestions.map((project) => (
                    <li key={project.href}>
                      <button
                        type="button"
                        className="workbench-related-suggestion"
                        onClick={() => addRelated(project)}
                      >
                        <span className="workbench-related-suggestion-title">
                          {project.title}
                        </span>
                        {project.author?.handle ? (
                          <span className="workbench-related-suggestion-meta">
                            by {project.author.handle}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : relatedQuery.trim() ? (
                <p className="workbench-flow-hint">no matching projects</p>
              ) : null}
            </div>
            {fileSummary ? (
              <p className="workbench-flow-copy">{fileSummary}</p>
            ) : null}
            {aiReady === false ? (
              <p className="workbench-flow-error">
                AI isn&apos;t configured. Add <code>ANTHROPIC_API_KEY</code> to{" "}
                <code>.env.local</code>, restart <code>npm run dev</code>, then
                try again. Until then, this button won&apos;t invent a real
                draft.
              </p>
            ) : null}
            {draftError ? (
              <p className="workbench-flow-error">{draftError}</p>
            ) : null}
          </form>
        ) : null}

        {step === "header" ? (
          <form
            className="workbench-flow-form"
            onSubmit={(event) => {
              event.preventDefault();
              goNext();
            }}
          >
            <label className="workbench-flow-field">
              <span className="workbench-flow-field-label">Title</span>
              <input
                className="workbench-submit-input"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="project title"
                aria-label="Project title"
                autoFocus={!analyzing}
                disabled={analyzing}
              />
            </label>
            <label className="workbench-flow-field">
              <span className="workbench-flow-field-label">Subtitle</span>
              <textarea
                className="workbench-submit-textarea"
                rows={3}
                value={lead}
                onChange={(event) => setLead(event.target.value)}
                placeholder="short subtitle…"
                aria-label="Project subtitle"
                disabled={analyzing}
              />
            </label>
            <label className="workbench-flow-field">
              <span className="workbench-flow-field-label">
                Social link (optional)
              </span>
              <input
                className="workbench-submit-input"
                type="url"
                placeholder="https://…"
                value={socialLink}
                onChange={(event) => setSocialLink(event.target.value)}
                aria-label="Social media link"
                disabled={analyzing}
              />
            </label>
            <div className="workbench-flow-field">
              <span className="workbench-flow-field-label">Cover</span>
              <p className="workbench-flow-hint">
                Uses a preview from your social link when one is set. Or upload
                a photo instead.
              </p>
              {coverImage ? (
                <div className="workbench-cover-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImage} alt="" />
                  <button
                    type="button"
                    className="workbench-submit-button workbench-submit-button--ghost"
                    onClick={() => setCoverImage(null)}
                    disabled={analyzing}
                  >
                    remove
                  </button>
                </div>
              ) : null}
              <label className="workbench-submit-button workbench-submit-button--ghost">
                {coverImage ? "replace photo" : "upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="workbench-sr-only"
                  onChange={onCoverImageUpload}
                  disabled={analyzing}
                />
              </label>
            </div>
          </form>
        ) : null}

        {step === "description" ? (
          <div className="workbench-flow-form">
            <WorkbenchRichEditor
              value={postHtml}
              onChange={(html) => setPostHtml(html)}
              placeholder="write the description…"
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </div>
        ) : null}

        {step === "materials" ? (
          <div className="workbench-flow-form">
            <button
              type="button"
              className="workbench-submit-button workbench-submit-button--ghost"
              onClick={addBlankPart}
            >
              + add material
            </button>
            {parts.map((part) => (
              <div key={part.id} className="workbench-flow-stack-item">
                <input
                  className="workbench-submit-input"
                  value={part.name}
                  onChange={(event) =>
                    updatePart(part.id, { name: event.target.value })
                  }
                  placeholder="material name"
                  aria-label="Material name"
                />
                <input
                  className="workbench-submit-input"
                  value={part.note || ""}
                  onChange={(event) =>
                    updatePart(part.id, { note: event.target.value })
                  }
                  placeholder="note (optional)"
                  aria-label="Material note"
                />
                <input
                  className="workbench-submit-input"
                  value={part.buyUrl}
                  onChange={(event) =>
                    updatePart(part.id, { buyUrl: event.target.value })
                  }
                  placeholder="buy url (optional)"
                  aria-label="Buy link"
                />
                <button
                  type="button"
                  className="workbench-doc-remove"
                  onClick={() => removePart(part.id)}
                >
                  remove
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {step === "howto" ? (
          <div className="workbench-flow-form">
            <button
              type="button"
              className="workbench-submit-button workbench-submit-button--ghost"
              onClick={addBlankStep}
            >
              + add step
            </button>
            {steps.map((item, index) => (
              <div key={item.id} className="workbench-flow-stack-item">
                <input
                  className="workbench-submit-input"
                  value={item.title}
                  onChange={(event) =>
                    updateStep(item.id, { title: event.target.value })
                  }
                  placeholder={`step ${index + 1} title`}
                  aria-label={`Step ${index + 1} title`}
                  data-step-title={item.id}
                />
                <textarea
                  className="workbench-submit-textarea"
                  rows={3}
                  value={item.details.join("\n")}
                  onChange={(event) =>
                    updateStep(item.id, {
                      details: event.target.value
                        ? event.target.value.split("\n")
                        : [""],
                    })
                  }
                  placeholder="details…"
                  aria-label={`Step ${index + 1} detail`}
                />
                {item.imageUrl ? (
                  <div className="workbench-step-image-preview">
                    <figure
                      className="workbench-figure workbench-step-figure"
                      style={{
                        width: `${snapWorkbenchImageWidth(item.imageWidth ?? 100)}%`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.imageUrl} alt="" />
                    </figure>
                    <div className="workbench-figure-controls">
                      <div
                        className="workbench-figure-sizes"
                        role="group"
                        aria-label={`Step ${index + 1} image size`}
                      >
                        {WORKBENCH_IMAGE_SIZES.map((size) => (
                          <button
                            key={size.id}
                            type="button"
                            className={
                              snapWorkbenchImageWidth(item.imageWidth ?? 100) ===
                              size.width
                                ? "workbench-figure-size is-active"
                                : "workbench-figure-size"
                            }
                            aria-pressed={
                              snapWorkbenchImageWidth(item.imageWidth ?? 100) ===
                              size.width
                            }
                            onClick={() =>
                              updateStep(item.id, { imageWidth: size.width })
                            }
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        className="workbench-figure-caption-input"
                        value={item.imageCaption || ""}
                        placeholder="Add a caption…"
                        onChange={(event) =>
                          updateStep(item.id, {
                            imageCaption: event.target.value,
                          })
                        }
                        aria-label={`Step ${index + 1} image caption`}
                      />
                    </div>
                    <button
                      type="button"
                      className="workbench-submit-button workbench-submit-button--ghost"
                      onClick={() =>
                        updateStep(item.id, {
                          imageUrl: null,
                          imageWidth: 100,
                          imageCaption: "",
                        })
                      }
                    >
                      remove image
                    </button>
                  </div>
                ) : null}
                <label className="workbench-submit-button workbench-submit-button--ghost">
                  {item.imageUrl ? "replace image" : "add image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="workbench-sr-only"
                    onChange={(event) => onStepImageUpload(item.id, event)}
                    aria-label={`Step ${index + 1} image`}
                  />
                </label>
                {item.videoUrl ? (
                  <div className="workbench-step-image-preview">
                    <video src={item.videoUrl} controls playsInline />
                    <button
                      type="button"
                      className="workbench-submit-button workbench-submit-button--ghost"
                      onClick={() => updateStep(item.id, { videoUrl: null })}
                    >
                      remove video
                    </button>
                  </div>
                ) : null}
                <label className="workbench-submit-button workbench-submit-button--ghost">
                  {item.videoUrl ? "replace video" : "add video"}
                  <input
                    type="file"
                    accept="video/*"
                    className="workbench-sr-only"
                    onChange={(event) => onStepVideoUpload(item.id, event)}
                    aria-label={`Step ${index + 1} video`}
                  />
                </label>
                <button
                  type="button"
                  className="workbench-doc-remove"
                  onClick={() => removeStep(item.id)}
                >
                  remove
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {step === "schematic" ? (
          <div className="workbench-flow-form">
            <label className="workbench-submit-button workbench-submit-button--ghost">
              upload schematic
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={onSchematicImageUpload}
              />
            </label>
            {schematics.map((item, index) => (
              <div key={item.id} className="workbench-flow-stack-item">
                <input
                  className="workbench-submit-input"
                  value={item.boardLabel}
                  onChange={(event) =>
                    updateSchematic(item.id, {
                      boardLabel: event.target.value,
                    })
                  }
                  aria-label={`Schematic ${index + 1} label`}
                />
                <button
                  type="button"
                  className="workbench-doc-remove"
                  onClick={() => removeSchematic(item.id)}
                >
                  remove
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {step === "scripts" ? (
          <form
            className={
              draggingFiles
                ? "workbench-flow-form is-dragging-files"
                : "workbench-flow-form"
            }
            onSubmit={(event) => {
              event.preventDefault();
              goNext();
            }}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="workbench-dropzone-actions">
              <label className="workbench-submit-button workbench-submit-button--ghost">
                choose files
                <input
                  type="file"
                  multiple
                  className="workbench-sr-only"
                  onChange={onFiles}
                />
              </label>
              <label className="workbench-submit-button workbench-submit-button--ghost">
                choose folder
                <input
                  type="file"
                  className="workbench-sr-only"
                  // @ts-expect-error webkitdirectory is non-standard
                  webkitdirectory=""
                  multiple
                  onChange={onFiles}
                />
              </label>
            </div>
            {files.length > 0 ? (
              <ul className="workbench-file-list">
                {files.map((file) => (
                  <li key={file.path}>
                    <span>{file.path}</span>
                    <button
                      type="button"
                      className="workbench-file-remove"
                      onClick={() => removeFile(file.path)}
                      aria-label={`Remove ${file.path}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <textarea
              className="workbench-submit-textarea"
              rows={6}
              placeholder="paste code"
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              aria-label="Paste code"
            />
            {draftError ? (
              <p className="workbench-flow-error">{draftError}</p>
            ) : null}
          </form>
        ) : null}

        {step === "done" ? (
          <div className="workbench-flow-form">
            <p className="workbench-flow-hint">saving your project…</p>
          </div>
        ) : null}
      </div>
    </section>
  );

  const modal =
    (variant === "link" || variant === "host") && open && mounted
      ? createPortal(
          <div
            className="workbench-flow"
            role="dialog"
            aria-modal="true"
            aria-label={editPostId ? "Edit project" : "Submit a project"}
            onClick={(event) => {
              if (event.target === event.currentTarget) closeFlow();
            }}
          >
            <div
              className={
                step === "code" && draggingFiles
                  ? "workbench-flow-modal is-dragging-files"
                  : "workbench-flow-modal"
              }
              onClick={(event) => event.stopPropagation()}
              onDragEnter={step === "code" ? onDragEnter : undefined}
              onDragOver={step === "code" ? onDragOver : undefined}
              onDragLeave={step === "code" ? onDragLeave : undefined}
              onDrop={step === "code" ? onDrop : undefined}
            >
              {step === "code" ? (
                <button
                  type="button"
                  className="workbench-flow-close workbench-flow-close--modal"
                  onClick={closeFlow}
                  aria-label="Close"
                >
                  ×
                </button>
              ) : null}
              <div
                className={
                  step === "code"
                    ? "workbench-flow-body workbench-flow-body--code"
                    : "workbench-flow-body"
                }
              >
                {step === "code" ? null : documentPane}
                {formPane}
              </div>

              <div
                className={
                  step === "code"
                    ? "workbench-flow-footer workbench-flow-footer--code"
                    : "workbench-flow-footer"
                }
              >
                <button
                  className="workbench-submit-button workbench-submit-button--ghost"
                  type="button"
                  onClick={goBack}
                  disabled={!canGoBack || analyzing}
                >
                  back
                </button>

                {step === "code" ? (
                  <div className="workbench-flow-footer-spacer" aria-hidden="true" />
                ) : (
                  <nav
                    className="workbench-flow-stepper"
                    aria-label="Submit progress"
                  >
                    <div
                      className="workbench-flow-stepper-track"
                      aria-hidden="true"
                    >
                      <div
                        className="workbench-flow-stepper-fill"
                        style={{
                          width: `${
                            (Math.max(previewStepIndex, 0) /
                              Math.max(PREVIEW_STEPS.length - 1, 1)) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                    <ol className="workbench-flow-stepper-list">
                      {PREVIEW_STEPS.map((item) => {
                        const itemIndex = PREVIEW_STEPS.indexOf(item);
                        const current =
                          step === "done"
                            ? item === "scripts"
                            : item === step;
                        const complete =
                          step === "done" ||
                          (previewStepIndex >= 0 &&
                            itemIndex < previewStepIndex);
                        return (
                          <li
                            key={item}
                            className={
                              current
                                ? "is-current"
                                : complete
                                  ? "is-complete"
                                  : undefined
                            }
                          >
                            <button
                              type="button"
                              className="workbench-flow-stepper-btn"
                              onClick={() => setStep(item)}
                              disabled={analyzing}
                            >
                              {STEP_LABEL[item]}
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </nav>
                )}

                {step === "code" ? (
                  <div className="workbench-flow-footer-actions">
                    <button
                      className="workbench-submit-button workbench-submit-button--ghost"
                      type="button"
                      onClick={() => {
                        ensureDraft();
                        setStep("header");
                      }}
                      disabled={analyzing}
                    >
                      write it myself
                    </button>
                    <button
                      className="workbench-submit-button"
                      type="button"
                      onClick={goNext}
                      disabled={
                        analyzing ||
                        aiReady === false ||
                        (!files.length && !paste.trim())
                      }
                    >
                      {nextLabel}
                    </button>
                  </div>
                ) : editingPreview ? (
                  <div className="workbench-flow-footer-actions">
                    {step !== "scripts" ? (
                      <button
                        className="workbench-submit-button workbench-submit-button--ghost"
                        type="button"
                        onClick={goNext}
                        disabled={analyzing}
                      >
                        next
                      </button>
                    ) : null}
                    <button
                      className="workbench-submit-button"
                      type="button"
                      onClick={goSaveEdit}
                      disabled={analyzing || !isEditDirty}
                    >
                      {analyzing ? "saving…" : "save"}
                    </button>
                  </div>
                ) : (
                  <button
                    className="workbench-submit-button"
                    type="button"
                    onClick={goNext}
                    disabled={analyzing && step !== "done"}
                  >
                    {nextLabel}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  if (variant === "host") {
    return modal;
  }

  return (
    <>
      <button
        type="button"
        className={
          variant === "widget"
            ? "workbench-widget-cta"
            : "workbench-submit-link"
        }
        onClick={triggerOpen}
      >
        submit a project <span aria-hidden="true">+</span>
      </button>
      {modal}
    </>
  );
}
