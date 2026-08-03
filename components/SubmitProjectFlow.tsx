"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
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
import { fetchSocialHints } from "@/lib/socialHints";
import {
  searchWorkbenchProjects,
} from "@/lib/workbenchProjects";
import WorkbenchSchematic from "@/components/WorkbenchSchematic";
import WorkbenchRichEditor, {
  buildProjectPostHtml,
  fileBasename,
  socialHostLabel,
  withSocialInPostHtml,
} from "@/components/WorkbenchRichEditor";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";
import {
  openWorkbenchSubmit,
  savePostEdit,
  type WorkbenchPostDraft,
} from "@/lib/workbenchPostEdits";

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
};

type RelatedProject = {
  title: string;
  href: string;
  authorHandle?: string;
};

type WizardStep =
  | "social"
  | "related"
  | "code"
  | "review"
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
  "social",
  "related",
  "review",
  "done",
];

const STEP_LABEL: Record<WizardStep, string> = {
  social: "social",
  related: "related",
  code: "code",
  review: "post",
  done: "done",
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
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [paste, setPaste] = useState("");
  const [result, setResult] = useState<ReverseEngineerResult | null>(null);
  const [parts, setParts] = useState<PartItem[]>([]);
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [schematics, setSchematics] = useState<SchematicItem[]>([]);
  const [lead, setLead] = useState("");
  const [postHtml, setPostHtml] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);

  const historyRef = useRef<DocSnapshot[]>([cloneDoc(EMPTY_DOC)]);
  const historyIndexRef = useRef(0);
  const skipHistoryRef = useRef(false);
  const pendingSubmitRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const code = useMemo(() => combineFiles(files, paste), [files, paste]);

  function currentDoc(): DocSnapshot {
    return {
      projectName,
      socialLink,
      related,
      lead,
      postHtml,
      parts,
      steps,
      schematics,
    };
  }

  function applyDoc(snapshot: DocSnapshot) {
    skipHistoryRef.current = true;
    setProjectName(snapshot.projectName);
    setSocialLink(snapshot.socialLink);
    setRelated(snapshot.related);
    setLead(snapshot.lead);
    setPostHtml(snapshot.postHtml);
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
      ),
    [relatedQuery, related],
  );

  const stepIndex = STEP_ORDER.indexOf(step);
  const stepCount = STEP_ORDER.length;

  function reset() {
    setStep("code");
    setEditPostId(null);
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
    setAnalyzing(false);
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
      related: [],
      lead: draft.lead,
      postHtml: draft.postHtml,
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
    setFiles(draft.files.map((file) => ({ path: file.path, content: file.content })));
    setPaste("");
    setRelated([]);
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
    setStep("review");
    setOpen(true);
  }

  function saveEdit() {
    if (!editPostId) return;
    if (!user) {
      pendingSubmitRef.current = true;
      openLogin("log in to save your edits");
      return;
    }
    pendingSubmitRef.current = false;
    const draft: WorkbenchPostDraft = {
      postId: editPostId,
      projectName: projectName.trim() || "untitled project",
      lead,
      postHtml,
      socialLink,
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
    };
    savePostEdit(draft);
    window.dispatchEvent(
      new CustomEvent("workbench-post-edited", { detail: { postId: editPostId } }),
    );
    closeFlow();
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

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (hasFileDrag(event.dataTransfer.types)) {
      setDraggingFiles(true);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (hasFileDrag(event.dataTransfer.types)) {
      event.dataTransfer.dropEffect = "copy";
      setDraggingFiles(true);
    }
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setDraggingFiles(false);
  }

  async function onDrop(event: DragEvent<HTMLDivElement>) {
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
    if (editPostId) {
      closeFlow();
      return;
    }
    if (step === "social") setStep("code");
    else if (step === "related") setStep("social");
    else if (step === "review") setStep("related");
    else if (step === "done") setStep("review");
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

  function skipStep() {
    if (step === "code") {
      ensureDraft();
      setStep("social");
    } else if (step === "social") {
      void enrichFromSocialAndContinue();
    } else if (step === "related") setStep("review");
    else if (step === "review") submitVerified();
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
    setAnalyzing(true);
    try {
      const parsed = await runAnalyze();
      if (projectName.trim() && projectName !== "untitled project") {
        parsed.projectName = projectName.trim();
      }
      applyAnalysis(parsed);
      setStep("social");
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
      setStep("related");
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

  function submitVerified() {
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

    const summary = postHtml.trim() || lead.trim() || result?.summary || "";

    const body = [
      `project: ${title}`,
      `author: ${user.handle}`,
      `social: ${socialLink.trim() || "none"}`,
      `related: ${
        related.length
          ? related
              .map(
                (project) =>
                  `${project.title}${project.authorHandle ? ` by ${project.authorHandle}` : ""} (${project.href})`,
              )
              .join("; ")
          : "none"
      }`,
      `files: ${
        files.length
          ? files.map((file) => file.path).join(", ")
          : paste.trim()
            ? "pasted code"
            : "none"
      }`,
      "",
      "SUBTITLE",
      lead.trim() || "none",
      "",
      "DESCRIPTION",
      summary || "none",
      "",
      "MATERIALS",
      ...(parts.length
        ? parts.map(
            (part) =>
              `- ${part.name}${part.note ? ` (${part.note})` : ""} · ${part.buyUrl}`,
          )
        : ["- none"]),
      "",
      "STEPS",
      ...(steps.length
        ? steps.map(
            (item, index) =>
              `${index + 1}. ${item.title}\n${item.details.map((d) => `   - ${d}`).join("\n")}`,
          )
        : ["- none"]),
      "",
      "SCHEMATIC",
      ...(schematics.length
        ? schematics.map((item, index) => {
            const heading = `--- schematic ${index + 1} (${item.source}) ---`;
            if (item.imageUrl) {
              return `${heading}\nuploaded image (data url omitted from email)`;
            }
            return `${heading}\n${item.boardLabel}`;
          })
        : ["- none"]),
      "",
      "CODE",
      code.slice(0, 12000) || "none",
    ].join("\n");

    const subject = encodeURIComponent(`Work bench project: ${title}`);
    window.location.href = `mailto:malvika.jain@icloud.com?subject=${subject}&body=${encodeURIComponent(body)}`;
    setStep("done");
  }

  useEffect(() => {
    if (!user || !pendingSubmitRef.current || !open) return;
    if (step !== "review") {
      pendingSubmitRef.current = false;
      return;
    }
    if (editPostId) saveEdit();
    else submitVerified();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume once after login
  }, [user]);

  function triggerOpen() {
    if (variant === "widget" || variant === "host") {
      openWorkbenchSubmit();
      return;
    }
    openFlow();
  }

  function onSocialContinue(event: FormEvent) {
    event.preventDefault();
    void enrichFromSocialAndContinue();
  }

  function onRelatedContinue(event: FormEvent) {
    event.preventDefault();
    setStep("review");
  }

  function onCodeContinue(event: FormEvent) {
    event.preventDefault();
    void analyzeAndContinue();
  }

  const stepProgress = editPostId
    ? null
    : `${String(stepIndex + 1).padStart(2, "0")} / ${stepCount} · ${STEP_LABEL[step]}`;

  const documentPane = (
    <aside
      className={
        step === "review"
          ? "workbench-flow-pane workbench-flow-pane--preview workbench-flow-pane--doc"
          : "workbench-flow-pane workbench-flow-pane--preview"
      }
      aria-label="Project post preview"
    >
      <div className="workbench-flow-pane-head">
        <p className="workbench-flow-step">preview</p>
        <p className="workbench-flow-pane-role">draft</p>
        <p className="workbench-flow-pane-note">
          {step === "review"
            ? "edit the post before submitting"
            : "live post draft — edits appear here"}
        </p>
      </div>
      <div className="workbench-preview-frame">
      <div className="workbench-doc workbench-doc--project workbench-project--draft">
        <header className="workbench-project-head">
          <h1 className="workbench-project-title">
            <input
              className="workbench-project-title-input"
              value={projectName}
              onChange={(event) => {
                setProjectName(event.target.value);
              }}
              placeholder="project title"
              aria-label="Project title"
            />
            {user?.displayName || user?.handle ? (
              <>
                {" "}
                <span className="workbench-project-by">by</span>{" "}
                {user.displayName || user.handle}
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
                >
                  {socialHostLabel(socialLink)}
                </a>
              </>
            ) : null}
          </h1>
          <textarea
            className="workbench-project-lead--edit"
            value={lead}
            onChange={(event) => setLead(event.target.value)}
            placeholder="project subtitle…"
            rows={2}
            aria-label="Project subtitle"
          />
          {socialLink.trim() ? (
            /instagram\.com/i.test(socialLink) ? (
              <div className="workbench-project-reel workbench-project-reel--under-subtitle">
                <iframe
                  src={`${socialLink.replace(/\/$/, "")}/embed`}
                  title="project social embed"
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            ) : (
              <a
                className="workbench-project-link"
                href={socialLink.trim()}
                target="_blank"
                rel="noopener noreferrer"
              >
                open on {socialHostLabel(socialLink)}
              </a>
            )
          ) : null}
        </header>


        <nav className="workbench-project-toc" aria-label="Table of contents">
          {(
            [
              "description",
              "materials",
              "steps",
              "schematic",
              "scripts",
            ] as const
          ).map((label) => (
            <a key={label} href={`#draft-${label}`}>
              {label}
            </a>
          ))}
        </nav>

        <section
          id="draft-description"
          className="workbench-project-section"
        >
          <h2 className="workbench-project-heading">description</h2>
          <WorkbenchRichEditor
            value={postHtml}
            onChange={(html) => {
              setPostHtml(html);
              setResult((current) =>
                current
                  ? {
                      ...current,
                      summary: lead || html,
                      projectName: projectName || current.projectName,
                    }
                  : {
                      projectName: projectName || "untitled project",
                      summary: lead || html,
                      materials: [],
                      steps: [],
                      schematic: null,
                    },
              );
            }}
            placeholder="write the description…"
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </section>

        <section id="draft-materials" className="workbench-project-section">
          <div className="workbench-project-section-head">
            <h2 className="workbench-project-heading">materials</h2>
            <button
              type="button"
              className="workbench-doc-add"
              onClick={addBlankPart}
            >
              + add
            </button>
          </div>
          {parts.length > 0 ? (
            <div className="workbench-project-materials">
              {parts.map((part) => {
                const buyHref =
                  part.buyUrl.trim() ||
                  (part.name.trim() ? amazonSearchUrl(part.name) : "");
                return (
                  <div key={part.id} className="workbench-project-material">
                    <div className="workbench-project-material-copy">
                      <input
                        data-part-name={part.id}
                        className="workbench-project-material-name-input workbench-project-material-name"
                        value={part.name}
                        onChange={(event) =>
                          updatePart(part.id, { name: event.target.value })
                        }
                        placeholder="material name"
                        aria-label="Material name"
                      />
                      <input
                        className="workbench-project-material-note-input workbench-project-material-note"
                        value={part.note || ""}
                        onChange={(event) =>
                          updatePart(part.id, { note: event.target.value })
                        }
                        placeholder="note"
                        aria-label="Material note"
                      />
                      <input
                        className="workbench-project-material-buy-input"
                        value={part.buyUrl}
                        onChange={(event) =>
                          updatePart(part.id, { buyUrl: event.target.value })
                        }
                        placeholder="url to buy"
                        aria-label="Buy link"
                      />
                    </div>
                    <div
                      className="workbench-project-material-pic workbench-project-material-pic--empty"
                      aria-hidden="true"
                    />
                    <div className="workbench-project-material-actions">
                      {buyHref ? (
                        <a
                          className="workbench-project-material-buy"
                          href={buyHref}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          buy
                        </a>
                      ) : (
                        <span className="workbench-project-material-buy">
                          buy
                        </span>
                      )}
                      <button
                        type="button"
                        className="workbench-doc-remove"
                        onClick={() => removePart(part.id)}
                        aria-label={`Remove ${part.name || "material"}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="workbench-project-copy">
              no materials yet —{" "}
              <button
                type="button"
                className="workbench-doc-add"
                onClick={addBlankPart}
              >
                add one
              </button>
            </p>
          )}
        </section>

        <section id="draft-steps" className="workbench-project-section">
          <div className="workbench-project-section-head">
            <h2 className="workbench-project-heading">steps</h2>
            <button
              type="button"
              className="workbench-doc-add"
              onClick={addBlankStep}
            >
              + add
            </button>
          </div>
          {steps.length > 0 ? (
            <ol className="workbench-project-steps">
              {steps.map((item, index) => (
                <li key={item.id} className="workbench-project-step">
                  <span className="workbench-project-step-num">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="workbench-project-step-body">
                    <div className="workbench-doc-section-head">
                      <input
                        data-step-title={item.id}
                        className="workbench-project-step-title-input workbench-project-step-title"
                        value={item.title}
                        onChange={(event) =>
                          updateStep(item.id, { title: event.target.value })
                        }
                        placeholder="step title"
                        aria-label={`Step ${index + 1} title`}
                      />
                      <button
                        type="button"
                        className="workbench-doc-remove"
                        onClick={() => removeStep(item.id)}
                        aria-label={`Remove step ${index + 1}`}
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      className="workbench-project-step-detail-input"
                      value={item.details.join("\n")}
                      onChange={(event) =>
                        updateStep(item.id, {
                          details: event.target.value
                            ? event.target.value.split("\n")
                            : [""],
                        })
                      }
                      placeholder="detail"
                      rows={3}
                      aria-label={`Step ${index + 1} detail`}
                    />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="workbench-project-copy">
              no steps yet —{" "}
              <button
                type="button"
                className="workbench-doc-add"
                onClick={addBlankStep}
              >
                add one
              </button>
            </p>
          )}
        </section>

        <section id="draft-schematic" className="workbench-project-section">
          <div className="workbench-project-section-head">
            <h2 className="workbench-project-heading">schematic</h2>
            <label className="workbench-doc-add workbench-schematic-upload-btn">
              upload
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={onSchematicImageUpload}
              />
            </label>
          </div>
          {schematics.length > 0 ? (
            <div className="workbench-schematic-list">
              {schematics.map((item, index) => (
                <div key={item.id} className="workbench-schematic-card">
                  <div className="workbench-doc-section-head">
                    <input
                      className="workbench-project-material-name-input"
                      value={item.boardLabel}
                      onChange={(event) =>
                        updateSchematic(item.id, {
                          boardLabel: event.target.value,
                        })
                      }
                      aria-label={`Schematic ${index + 1} label`}
                    />
                    <div className="workbench-file-actions">
                      <button
                        type="button"
                        className="workbench-project-link"
                        onClick={(event) => {
                          if (item.imageUrl) {
                            const name =
                              item.boardLabel.trim() ||
                              filenameFromDataUrl(
                                item.imageUrl,
                                `schematic-${index + 1}`,
                              );
                            downloadHref(name, item.imageUrl);
                            return;
                          }
                          const card = (
                            event.currentTarget as HTMLElement
                          ).closest(".workbench-schematic-card");
                          const svg = card?.querySelector("svg");
                          if (!svg) return;
                          const markup = new XMLSerializer().serializeToString(
                            svg,
                          );
                          downloadTextFile(
                            `schematic-${index + 1}.svg`,
                            markup,
                            "image/svg+xml;charset=utf-8",
                          );
                        }}
                      >
                        download
                      </button>
                      <button
                        type="button"
                        className="workbench-doc-remove"
                        onClick={() => removeSchematic(item.id)}
                        aria-label={`Remove schematic ${index + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
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
          ) : null}
        </section>

        <section id="draft-scripts" className="workbench-project-section">
          <div className="workbench-project-section-head">
            <h2 className="workbench-project-heading">scripts</h2>
            <label className="workbench-doc-add workbench-schematic-upload-btn">
              upload
              <input
                type="file"
                accept=".ino,.py,.cpp,.c,.h,.hpp,.js,.jsx,.ts,.tsx,.mjs,.txt,.md,.json,.toml,.yml,.yaml,.rs,.go,.java,.kt,.swift,.rb,.php,.cs,.lua,.sh,.html,.css,.sql,.r"
                multiple
                hidden
                onChange={onFiles}
              />
            </label>
          </div>
          {scriptEntries(files, paste).map((script, index) => {
            const name = fileBasename(script.name);
            const ext = name.includes(".")
              ? `.${name.split(".").pop()}`
              : "";
            const isPaste = script.name === "pasted-code.txt";
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
                    <input
                      data-script-name={script.name}
                      className="workbench-project-script-name-input"
                      defaultValue={name}
                      key={`name:${script.name}`}
                      onBlur={(event) => {
                        const nextName = event.target.value.trim() || name;
                        if (nextName === name) return;
                        if (isPaste) {
                          setFiles((current) => [
                            ...current,
                            { path: nextName, content: script.content },
                          ]);
                          setPaste("");
                          return;
                        }
                        updateFile(script.name, { path: nextName });
                      }}
                      placeholder="filename"
                      aria-label={`Script ${index + 1} name`}
                    />
                  </h3>
                  <div className="workbench-file-actions">
                    <button
                      type="button"
                      className="workbench-project-link"
                      onClick={() => downloadTextFile(name, script.content)}
                    >
                      download{ext ? ` ${ext}` : ""}
                    </button>
                    <button
                      type="button"
                      className="workbench-doc-remove"
                      onClick={() => removeScript(script.name)}
                      aria-label={`Remove ${name}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <textarea
                  className="workbench-project-pre workbench-project-script-editor"
                  value={script.content}
                  onChange={(event) => {
                    if (isPaste) {
                      setPaste(event.target.value);
                      return;
                    }
                    updateFile(script.name, {
                      content: event.target.value,
                    });
                  }}
                  placeholder="code…"
                  rows={8}
                  spellCheck={false}
                  aria-label={`${name} content`}
                />
              </div>
            );
          })}
        </section>
      </div>
      </div>
    </aside>
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
              className="workbench-flow-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="workbench-flow-top">
                <p className="workbench-flow-kicker">
                  {editPostId ? "edit post" : "submit a project"}
                </p>
                <div className="workbench-flow-top-actions">
                  <button
                    type="button"
                    className="workbench-flow-close"
                    onClick={closeFlow}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div
                className={
                  step === "review"
                    ? "workbench-flow-split workbench-flow-split--review"
                    : "workbench-flow-split"
                }
              >
                {step === "review" ? (
                  <div className="workbench-review-bar">
                    <div className="workbench-review-bar-copy">
                      {stepProgress ? (
                        <p className="workbench-flow-step">{stepProgress}</p>
                      ) : null}
                      <p className="workbench-flow-question">
                        {editPostId ? "edit post" : "fill in · your post"}
                      </p>
                    </div>
                    <div className="workbench-flow-actions workbench-flow-actions--review">
                      <button
                        className="workbench-submit-button workbench-submit-button--ghost"
                        type="button"
                        onClick={goBack}
                      >
                        {editPostId ? "cancel" : "back"}
                      </button>
                      <button
                        className="workbench-submit-button"
                        type="button"
                        onClick={editPostId ? saveEdit : submitVerified}
                      >
                        {editPostId ? "save" : "submit"}
                      </button>
                    </div>
                  </div>
                ) : (
                <section className="workbench-flow-pane workbench-flow-pane--form">
                  <div className="workbench-flow-pane-head">
                    {stepProgress ? (
                      <p className="workbench-flow-step">{stepProgress}</p>
                    ) : (
                      <p className="workbench-flow-step">edit</p>
                    )}
                    <p className="workbench-flow-pane-role">fill in</p>
                    <p className="workbench-flow-pane-note">
                      {step === "code"
                        ? "upload or paste the project code"
                        : step === "social"
                          ? "optional social context for the draft"
                          : step === "related"
                            ? "link related work bench posts"
                            : step === "done"
                              ? "project submitted"
                              : "complete this step"}
                    </p>
                  </div>
                  {step === "social" ? (
                    <form
                      className="workbench-flow-form"
                      onSubmit={onSocialContinue}
                    >
                      <input
                        className="workbench-submit-input"
                        type="url"
                        placeholder="https://…"
                        value={socialLink}
                        onChange={(e) => setSocialLink(e.target.value)}
                        aria-label="Social media link"
                        autoFocus
                      />
                      <p className="workbench-flow-hint">
                        used with your scripts so ai can draft the project
                        details.
                      </p>
                      <div className="workbench-flow-actions">
                        <button
                          className="workbench-submit-button workbench-submit-button--ghost"
                          type="button"
                          onClick={goBack}
                          disabled={analyzing}
                        >
                          back
                        </button>
                        <button
                          className="workbench-submit-button workbench-submit-button--ghost"
                          type="button"
                          onClick={skipStep}
                          disabled={analyzing}
                        >
                          skip
                        </button>
                        <button
                          className="workbench-submit-button"
                          type="submit"
                          disabled={analyzing}
                        >
                          {analyzing ? "analyzing…" : "continue"}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {step === "related" ? (
                    <form
                      className="workbench-flow-form"
                      onSubmit={onRelatedContinue}
                    >
                      {related.length > 0 ? (
                        <div className="workbench-tiles">
                          {related.map((project) => (
                            <div key={project.href} className="workbench-tile">
                              <div className="workbench-tile-main">
                                <p className="workbench-tile-title">
                                  {project.title}
                                  {project.authorHandle
                                    ? ` by ${project.authorHandle}`
                                    : ""}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="workbench-tile-remove"
                                onClick={() => removeRelated(project.href)}
                                aria-label={`Remove ${project.title}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="workbench-part-search">
                        <input
                          className="workbench-submit-input"
                          type="search"
                          placeholder="search…"
                          value={relatedQuery}
                          onChange={(event) =>
                            setRelatedQuery(event.target.value)
                          }
                          aria-label="Search work bench posts"
                          autoFocus
                        />
                        <div className="workbench-part-results workbench-part-results--static">
                          {relatedSuggestions.length > 0 ? (
                            relatedSuggestions.map((project) => (
                              <button
                                key={project.href}
                                type="button"
                                className="workbench-part-result"
                                onClick={() => addRelated(project)}
                              >
                                <span>
                                  {project.title}
                                  {project.author?.handle
                                    ? ` by ${project.author.handle}`
                                    : ""}
                                </span>
                                <span className="workbench-part-result-add">
                                  add
                                </span>
                              </button>
                            ))
                          ) : (
                            <p className="workbench-part-empty">
                              {relatedQuery.trim()
                                ? "no matches"
                                : "type to search"}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="workbench-flow-actions">
                        <button
                          className="workbench-submit-button workbench-submit-button--ghost"
                          type="button"
                          onClick={goBack}
                        >
                          back
                        </button>
                        <button
                          className="workbench-submit-button workbench-submit-button--ghost"
                          type="button"
                          onClick={() => setStep("review")}
                        >
                          skip
                        </button>
                        <button
                          className="workbench-submit-button"
                          type="submit"
                        >
                          continue
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {step === "code" ? (
                    <form
                      className="workbench-flow-form"
                      onSubmit={onCodeContinue}
                    >
                      <div
                        className={
                          draggingFiles
                            ? "workbench-dropzone is-dragging"
                            : "workbench-dropzone"
                        }
                        onDragEnter={onDragEnter}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                      >
                        <p className="workbench-dropzone-copy">
                          drop files or a folder
                        </p>
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
                                <div className="workbench-file-actions">
                                  <button
                                    type="button"
                                    className="workbench-file-download"
                                    onClick={() =>
                                      downloadTextFile(
                                        fileBasename(file.path),
                                        file.content,
                                      )
                                    }
                                  >
                                    download
                                  </button>
                                  <button
                                    type="button"
                                    className="workbench-file-remove"
                                    onClick={() => removeFile(file.path)}
                                    aria-label={`Remove ${file.path}`}
                                  >
                                    ×
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <textarea
                        className="workbench-submit-textarea"
                        rows={8}
                        placeholder="or paste code…"
                        value={paste}
                        onChange={(event) => setPaste(event.target.value)}
                        aria-label="Paste code"
                      />
                      {fileSummary ? (
                        <p className="workbench-flow-copy">{fileSummary}</p>
                      ) : null}
                      <div className="workbench-flow-actions">
                        <button
                          className="workbench-submit-button workbench-submit-button--ghost"
                          type="button"
                          onClick={skipStep}
                        >
                          skip
                        </button>
                        <button
                          className="workbench-submit-button"
                          type="submit"
                          disabled={analyzing}
                        >
                          {analyzing ? "analyzing…" : "continue"}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {step === "done" ? (
                    <div className="workbench-flow-form">
                      <p className="workbench-flow-hint">your project was sent.</p>
                      <div className="workbench-flow-actions">
                        <button
                          className="workbench-submit-button workbench-submit-button--ghost"
                          type="button"
                          onClick={goBack}
                        >
                          back
                        </button>
                        <button
                          className="workbench-submit-button"
                          type="button"
                          onClick={closeFlow}
                        >
                          close
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>
                )}

                {documentPane}
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
