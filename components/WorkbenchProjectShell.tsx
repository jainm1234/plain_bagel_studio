"use client";

import WorkbenchAccount from "@/components/WorkbenchAccount";
import WorkbenchComments from "@/components/WorkbenchComments";
import EditPostButton from "@/components/EditPostButton";
import Link from "next/link";
import type { ReactNode } from "react";
import type { WorkbenchPostDraft } from "@/lib/workbenchPostEdits";

function socialLabel(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("instagram")) return "instagram";
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("youtube") || host.includes("youtu.be")) return "youtube";
    if (host.includes("x.com") || host.includes("twitter")) return "x";
    return host;
  } catch {
    return "social";
  }
}

type Props = {
  children: ReactNode;
  author?: {
    id: string;
    handle: string;
  };
  title: string;
  lead?: string;
  socialLink?: string;
  postId?: string;
  editDraft?: WorkbenchPostDraft;
};

export default function WorkbenchProjectShell({
  children,
  author,
  title,
  lead,
  socialLink,
  postId,
  editDraft,
}: Props) {
  return (
    <main className="workbench-site">
      <div className="workbench-topbar">
        <Link href="/work-bench" className="workbench-back">
          ← back
        </Link>
        <div className="workbench-topbar-actions">
          {editDraft ? (
            <EditPostButton author={author} draft={editDraft} />
          ) : null}
          <WorkbenchAccount />
        </div>
      </div>

      <article className="workbench-project">
        <header className="workbench-project-head">
          <h1 className="workbench-project-title">
            {title}
            {author ? (
              <>
                {" "}
                <span className="workbench-project-by">by</span>{" "}
                <Link
                  href={`/work-bench/u/${author.id}`}
                  className="workbench-project-author"
                >
                  {author.handle}
                </Link>
              </>
            ) : null}
            {socialLink ? (
              <>
                {" "}
                <span className="workbench-project-by">on</span>{" "}
                <a
                  className="workbench-project-social"
                  href={socialLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {socialLabel(socialLink)}
                </a>
              </>
            ) : null}
          </h1>
          {lead ? <p className="workbench-project-lead">{lead}</p> : null}
          {socialLink && /instagram\.com/i.test(socialLink) ? (
            <div className="workbench-project-reel workbench-project-reel--under-subtitle">
              <iframe
                src={`${socialLink.replace(/\/$/, "")}/embed`}
                title={`${title} social embed`}
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
              />
            </div>
          ) : socialLink ? (
            <a
              className="workbench-project-link"
              href={socialLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              open on {socialLabel(socialLink)}
            </a>
          ) : null}
        </header>
        {children}
        {postId ? <WorkbenchComments postId={postId} /> : null}
      </article>
    </main>
  );
}
