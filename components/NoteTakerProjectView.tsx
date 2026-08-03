"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import NoteTakerSchematic from "@/components/NoteTakerSchematic";
import WorkbenchProjectShell from "@/components/WorkbenchProjectShell";
import {
  getPostEdit,
  mergePostDraft,
  type WorkbenchPostDraft,
} from "@/lib/workbenchPostEdits";

type MaterialImage = {
  name: string;
  src: string;
};

type Props = {
  author: { id: string; handle: string };
  draft: WorkbenchPostDraft;
  materialImages: MaterialImage[];
};

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function NoteTakerProjectView({
  author,
  draft: initialDraft,
  materialImages,
}: Props) {
  const [draft, setDraft] = useState(initialDraft);

  useEffect(() => {
    function refresh() {
      setDraft(mergePostDraft(initialDraft, getPostEdit(initialDraft.postId)));
    }
    refresh();
    function onEdited(event: Event) {
      const postId = (event as CustomEvent<{ postId: string }>).detail?.postId;
      if (postId && postId !== initialDraft.postId) return;
      refresh();
    }
    window.addEventListener("workbench-post-edited", onEdited);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("workbench-post-edited", onEdited);
      window.removeEventListener("storage", refresh);
    };
  }, [initialDraft]);

  const imageByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of materialImages) map.set(item.name, item.src);
    for (const part of draft.parts) {
      if (part.imageSrc) map.set(part.name, part.imageSrc);
    }
    return map;
  }, [draft.parts, materialImages]);

  const toc = [
    { label: "description", href: "#description" },
    { label: "materials", href: "#materials" },
    { label: "steps", href: "#steps" },
    { label: "schematic", href: "#schematic" },
    { label: "scripts", href: "#scripts" },
    { label: "comments", href: "#comments" },
  ];

  const descriptionText =
    stripHtml(draft.postHtml) || draft.lead || initialDraft.lead;

  return (
    <WorkbenchProjectShell
      title={draft.projectName || "note taker"}
      author={author}
      lead={draft.lead}
      socialLink={draft.socialLink}
      postId={draft.postId}
      editDraft={draft}
    >
      <nav className="workbench-project-toc" aria-label="Table of contents">
        {toc.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

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

      <section id="materials" className="workbench-project-section">
        <h2 className="workbench-project-heading">materials</h2>
        <div className="workbench-project-materials">
          {draft.parts.map((item) => {
            const src = imageByName.get(item.name);
            const buy = item.buyUrl;
            return (
              <div key={item.id} className="workbench-project-material">
                <div className="workbench-project-material-copy">
                  <p className="workbench-project-material-name">{item.name}</p>
                  {item.note ? (
                    <p className="workbench-project-material-note">{item.note}</p>
                  ) : null}
                </div>
                <div className="workbench-project-material-pic">
                  {src ? (
                    <Image
                      src={src}
                      alt={item.name}
                      width={400}
                      height={400}
                      className="workbench-project-material-img"
                    />
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

      <section id="steps" className="workbench-project-section">
        <h2 className="workbench-project-heading">steps</h2>
        <ol className="workbench-project-steps">
          {draft.steps.map((step, i) => (
            <li key={step.id} className="workbench-project-step">
              <span className="workbench-project-step-num">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="workbench-project-step-title">{step.title}</h3>
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

      <section id="schematic" className="workbench-project-section">
        <h2 className="workbench-project-heading">schematic</h2>
        {draft.schematics[0]?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="workbench-schematic-upload"
            src={draft.schematics[0].imageUrl}
            alt="schematic"
          />
        ) : (
          <NoteTakerSchematic />
        )}
      </section>

      <section id="scripts" className="workbench-project-section">
        <h2 className="workbench-project-heading">scripts</h2>
        {draft.files.map((script, index) => {
          const name = script.path.split("/").pop() || script.path;
          const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
          return (
            <div key={script.path} className="workbench-project-script">
              <div className="workbench-project-script-head">
                <h3 className="workbench-project-subheading">
                  <span className="workbench-project-step-num">
                    {String(index + 1).padStart(2, "0")} ·{" "}
                  </span>
                  {name}
                </h3>
                <a
                  className="workbench-project-link"
                  href={`/projects/note-taker/${name}`}
                  download
                >
                  download{ext}
                </a>
              </div>
              <pre className="workbench-project-pre">{script.content}</pre>
            </div>
          );
        })}
      </section>
    </WorkbenchProjectShell>
  );
}
