"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NoteTakerSchematic from "@/components/NoteTakerSchematic";
import WorkbenchPartCode from "@/components/WorkbenchPartCode";
import WorkbenchProjectShell from "@/components/WorkbenchProjectShell";
import WorkbenchSchematic from "@/components/WorkbenchSchematic";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";
import {
  fetchBuildProgress,
  highlightPartText,
  loadBuildProgress,
  marksForParts,
  mergeBuildProgress,
  persistBuildProgress,
  saveBuildProgress,
  type BuildProgress,
} from "@/lib/workbenchBuildGuide";
import {
  getPostEdit,
  mergePostDraft,
  type WorkbenchPostDraft,
} from "@/lib/workbenchPostEdits";
import { snapWorkbenchImageWidth } from "@/lib/workbenchImageSizes";

type Props = {
  author: { id: string; handle: string };
  draft: WorkbenchPostDraft;
  /** Prefer localStorage overlays when present. Default true. */
  useLocalEdits?: boolean;
};

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scriptDownloadHref(path: string, content: string) {
  if (path.includes("/") && !content) return path;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  return URL.createObjectURL(blob);
}

async function fetchRemoteDraft(postId: string) {
  try {
    const response = await fetch(`/api/posts/${encodeURIComponent(postId)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      draft?: WorkbenchPostDraft;
      author?: { id: string; handle: string };
    };
    return data.draft?.postId ? data : null;
  } catch {
    return null;
  }
}

export default function WorkbenchProjectView({
  author: initialAuthor,
  draft: initialDraft,
  useLocalEdits = true,
}: Props) {
  const { user, ready } = useWorkbenchAuth();
  const [author, setAuthor] = useState(initialAuthor);
  const [draft, setDraft] = useState(initialDraft);
  const [checkedMaterials, setCheckedMaterials] = useState<string[]>([]);
  const [checkedSteps, setCheckedSteps] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const remote = await fetchRemoteDraft(initialDraft.postId);
    let next = initialDraft;
    if (remote?.draft) {
      next = mergePostDraft(initialDraft, remote.draft);
      if (remote.author) setAuthor(remote.author);
    }
    if (useLocalEdits) {
      next = mergePostDraft(next, getPostEdit(initialDraft.postId));
    }
    setDraft(next);
  }, [initialDraft, useLocalEdits]);

  useEffect(() => {
    setAuthor(initialAuthor);
    setDraft(initialDraft);
    void refresh();
  }, [initialAuthor, initialDraft, refresh]);

  useEffect(() => {
    function onEdited(event: Event) {
      const postId = (event as CustomEvent<{ postId: string }>).detail?.postId;
      if (postId && postId !== initialDraft.postId) return;
      void refresh();
    }
    function onStorage() {
      void refresh();
    }
    window.addEventListener("workbench-post-edited", onEdited);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("workbench-post-edited", onEdited);
      window.removeEventListener("storage", onStorage);
    };
  }, [initialDraft.postId, refresh]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const local = loadBuildProgress(initialDraft.postId, user?.id);
    const anon = user ? loadBuildProgress(initialDraft.postId, null) : local;
    setCheckedMaterials(local.materials.length ? local.materials : anon.materials);
    setCheckedSteps(local.steps.length ? local.steps : anon.steps);

    if (!user) return;

    void (async () => {
      try {
        const remote = await fetchBuildProgress(initialDraft.postId);
        if (cancelled || !remote) return;
        const merged = mergeBuildProgress(remote, mergeBuildProgress(local, anon));
        setCheckedMaterials(merged.materials);
        setCheckedSteps(merged.steps);
        saveBuildProgress(initialDraft.postId, merged, user.id);
        const changed =
          merged.materials.length !== remote.materials.length ||
          merged.steps.length !== remote.steps.length ||
          merged.materials.some((id) => !remote.materials.includes(id)) ||
          merged.steps.some((id) => !remote.steps.includes(id));
        if (changed) {
          await persistBuildProgress(initialDraft.postId, merged);
        }
      } catch {
        // keep local checkboxes if sync fails
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialDraft.postId, ready, user?.id]);

  const materials = draft.parts.filter((part) => part.name.trim());
  const steps = draft.steps.filter(
    (step) =>
      step.title.trim() ||
      step.details.some((detail) => detail.trim()) ||
      step.imageUrl ||
      step.videoUrl,
  );
  const schematics = draft.schematics;
  const scripts = draft.files.filter(
    (file) => file.path.trim() || file.content.trim(),
  );
  const descriptionText =
    stripHtml(draft.postHtml) || draft.lead || initialDraft.lead;
  const hasDescription =
    Boolean(descriptionText) || /<(img|video|figure)\b/i.test(draft.postHtml);

  const partMarks = useMemo(() => marksForParts(materials), [materials]);
  const materialChecked = new Set(checkedMaterials);
  const stepChecked = new Set(checkedSteps);

  function persistProgress(nextMaterials: string[], nextSteps: string[]) {
    const progress: BuildProgress = {
      materials: nextMaterials,
      steps: nextSteps,
    };
    setCheckedMaterials(nextMaterials);
    setCheckedSteps(nextSteps);
    saveBuildProgress(draft.postId, progress, user?.id);
    if (user) {
      void persistBuildProgress(draft.postId, progress).catch(() => {
        // local copy already saved
      });
    }
  }

  function toggleMaterial(id: string) {
    const next = materialChecked.has(id)
      ? checkedMaterials.filter((item) => item !== id)
      : [...checkedMaterials, id];
    persistProgress(next, checkedSteps);
  }

  function toggleStep(id: string) {
    const next = stepChecked.has(id)
      ? checkedSteps.filter((item) => item !== id)
      : [...checkedSteps, id];
    persistProgress(checkedMaterials, next);
  }

  const toc = [
    hasDescription ? { label: "description", href: "#description" } : null,
    materials.length ? { label: "materials", href: "#materials" } : null,
    steps.length ? { label: "steps", href: "#steps" } : null,
    schematics.length ? { label: "schematic", href: "#schematic" } : null,
    scripts.length ? { label: "scripts", href: "#scripts" } : null,
    { label: "comments", href: "#comments" },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <WorkbenchProjectShell
      title={draft.projectName || "project"}
      author={author}
      lead={draft.lead}
      socialLink={draft.socialLink}
      coverImage={draft.coverImage}
      related={draft.related}
      postId={draft.postId}
      editDraft={draft}
    >
      {toc.length > 0 ? (
        <nav className="workbench-project-toc" aria-label="Table of contents">
          {toc.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}

      {hasDescription ? (
        <section id="description" className="workbench-project-section">
          <h2 className="workbench-project-heading">description</h2>
          {draft.postHtml.trim() ? (
            <div
              className="workbench-project-copy"
              dangerouslySetInnerHTML={{ __html: draft.postHtml }}
            />
          ) : (
            <p className="workbench-project-copy">{descriptionText}</p>
          )}
        </section>
      ) : null}

      {materials.length > 0 ? (
        <section id="materials" className="workbench-project-section">
          <div className="workbench-section-head">
            <h2 className="workbench-project-heading">materials</h2>
            <p className="workbench-progress-meta">
              {Math.min(materialChecked.size, materials.length)} /{" "}
              {materials.length} gathered
            </p>
          </div>
          <div className="workbench-project-materials">
            {materials.map((item, index) => {
              const buy = item.buyUrl;
              const mark = partMarks[index];
              const done = materialChecked.has(item.id);
              return (
                <div
                  key={item.id}
                  className={
                    done
                      ? "workbench-project-material is-checked"
                      : "workbench-project-material"
                  }
                >
                  <label className="workbench-check">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleMaterial(item.id)}
                    />
                    <span className="workbench-check-box" aria-hidden="true" />
                    <span className="workbench-sr-only">
                      {done ? "unmark" : "mark"} {item.name}
                    </span>
                  </label>
                  <div className="workbench-project-material-copy">
                    <p className="workbench-project-material-name">
                      {mark ? (
                        <WorkbenchPartCode code={mark.code} color={mark.color} />
                      ) : null}
                      {item.name}
                    </p>
                    {item.note ? (
                      <p className="workbench-project-material-note">
                        {item.note}
                      </p>
                    ) : null}
                  </div>
                  {buy ? (
                    <a
                      className="workbench-project-material-buy"
                      href={buy}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      buy
                    </a>
                  ) : (
                    <span className="workbench-project-material-buy">buy</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {steps.length > 0 ? (
        <section id="steps" className="workbench-project-section">
          <div className="workbench-section-head">
            <h2 className="workbench-project-heading">steps</h2>
            <p className="workbench-progress-meta">
              {Math.min(stepChecked.size, steps.length)} / {steps.length} done
            </p>
          </div>
          <ol className="workbench-project-steps">
            {steps.map((step, i) => {
              const done = stepChecked.has(step.id);
              return (
                <li
                  key={step.id}
                  className={
                    done
                      ? "workbench-project-step is-checked"
                      : "workbench-project-step"
                  }
                >
                  <label className="workbench-check workbench-check--step">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleStep(step.id)}
                    />
                    <span className="workbench-check-box" aria-hidden="true" />
                    <span className="workbench-project-step-num">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </label>
                  <div>
                    <h3 className="workbench-project-step-title">
                      {highlightPartText(step.title, partMarks)}
                    </h3>
                    {step.imageUrl ? (
                      <figure
                        className="workbench-figure workbench-step-figure"
                        style={{
                          width: `${snapWorkbenchImageWidth(step.imageWidth ?? 100)}%`,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className="workbench-step-image"
                          src={step.imageUrl}
                          alt=""
                        />
                        {step.imageCaption?.trim() ? (
                          <figcaption className="workbench-figure-caption">
                            {step.imageCaption.trim()}
                          </figcaption>
                        ) : null}
                      </figure>
                    ) : null}
                    {step.videoUrl ? (
                      <video
                        className="workbench-step-video"
                        src={step.videoUrl}
                        controls
                        playsInline
                      />
                    ) : null}
                    <ul className="workbench-project-step-details">
                      {step.details
                        .filter((detail) => detail.trim())
                        .map((detail) => (
                          <li key={detail}>
                            {highlightPartText(detail, partMarks)}
                          </li>
                        ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {schematics.length > 0 ? (
        <section id="schematic" className="workbench-project-section">
          <h2 className="workbench-project-heading">schematic</h2>
          <div className="workbench-schematic-list">
            {schematics.map((item) =>
              item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={item.id}
                  className="workbench-schematic-upload"
                  src={item.imageUrl}
                  alt={item.boardLabel || "schematic"}
                />
              ) : draft.postId === "note-taker" ? (
                <NoteTakerSchematic key={item.id} />
              ) : (
                <WorkbenchSchematic
                  key={item.id}
                  boardLabel={item.boardLabel}
                  buttonPin={item.buttonPin}
                  ledPin={item.ledPin}
                  hasOnboardMic={item.hasOnboardMic}
                />
              ),
            )}
          </div>
        </section>
      ) : null}

      {scripts.length > 0 ? (
        <section id="scripts" className="workbench-project-section">
          <h2 className="workbench-project-heading">scripts</h2>
          {scripts.map((script, index) => {
            const name = script.path.split("/").pop() || script.path || "script";
            const href =
              draft.postId === "note-taker"
                ? `/projects/note-taker/${name}`
                : scriptDownloadHref(script.path, script.content);
            return (
              <div
                key={`${script.path}-${index}`}
                className="workbench-project-script"
              >
                <div className="workbench-project-script-head">
                  <h3 className="workbench-project-subheading">
                    <span className="workbench-project-step-num">
                      {String(index + 1).padStart(2, "0")} ·{" "}
                    </span>
                    {name}
                  </h3>
                  <a
                    className="workbench-project-link"
                    href={href}
                    download={name}
                  >
                    download
                  </a>
                </div>
                <pre className="workbench-project-pre">{script.content}</pre>
              </div>
            );
          })}
        </section>
      ) : null}
    </WorkbenchProjectShell>
  );
}
