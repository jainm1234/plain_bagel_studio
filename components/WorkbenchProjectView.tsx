"use client";

import { useCallback, useEffect, useState } from "react";
import NoteTakerSchematic from "@/components/NoteTakerSchematic";
import WorkbenchProjectShell from "@/components/WorkbenchProjectShell";
import WorkbenchSchematic from "@/components/WorkbenchSchematic";
import {
  getPostEdit,
  mergePostDraft,
  type WorkbenchPostDraft,
} from "@/lib/workbenchPostEdits";

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
  const [author, setAuthor] = useState(initialAuthor);
  const [draft, setDraft] = useState(initialDraft);

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
    window.addEventListener("workbench-post-edited", onEdited);
    window.addEventListener("storage", () => void refresh());
    return () => {
      window.removeEventListener("workbench-post-edited", onEdited);
    };
  }, [initialDraft.postId, refresh]);

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
    Boolean(descriptionText) || /<(img|video)\b/i.test(draft.postHtml);

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
          <h2 className="workbench-project-heading">materials</h2>
          <div className="workbench-project-materials">
            {materials.map((item) => {
              const buy = item.buyUrl;
              return (
                <div key={item.id} className="workbench-project-material">
                  <div className="workbench-project-material-copy">
                    <p className="workbench-project-material-name">
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
          <h2 className="workbench-project-heading">steps</h2>
          <ol className="workbench-project-steps">
            {steps.map((step, i) => (
              <li key={step.id} className="workbench-project-step">
                <span className="workbench-project-step-num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="workbench-project-step-title">{step.title}</h3>
                  {step.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="workbench-step-image"
                      src={step.imageUrl}
                      alt=""
                    />
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
                        <li key={detail}>{detail}</li>
                      ))}
                  </ul>
                </div>
              </li>
            ))}
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
            const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
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
                    download{ext}
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
