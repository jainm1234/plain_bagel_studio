"use client";

import WorkbenchAccount from "@/components/WorkbenchAccount";
import WorkbenchComments from "@/components/WorkbenchComments";
import EditPostButton from "@/components/EditPostButton";
import DeletePostButton from "@/components/DeletePostButton";
import WorkbenchProjectCover from "@/components/WorkbenchProjectCover";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  displayAuthorHandle,
  type WorkbenchPostDraft,
} from "@/lib/workbenchPostEdits";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";

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
  coverImage?: string | null;
  postId?: string;
  editDraft?: WorkbenchPostDraft;
};

export default function WorkbenchProjectShell({
  children,
  author,
  title,
  lead,
  socialLink,
  coverImage,
  postId,
  editDraft,
}: Props) {
  const { user } = useWorkbenchAuth();
  const authorHandle = displayAuthorHandle(user, author);

  return (
    <main className="workbench-site">
      <div className="workbench-topbar">
        <Link href="/work-bench" className="workbench-back">
          ← back
        </Link>
        <div className="workbench-topbar-actions">
          {editDraft ? (
            <>
              <EditPostButton
                author={author}
                draft={editDraft}
                className="workbench-topbar-edit"
              />
              <DeletePostButton
                author={author}
                draft={editDraft}
                className="workbench-topbar-edit"
              />
            </>
          ) : null}
          <WorkbenchAccount />
        </div>
      </div>

      <article className="workbench-project">
        <header className="workbench-project-head">
          <WorkbenchProjectCover
            coverImage={coverImage}
            socialLink={socialLink}
            title={`${title} cover`}
          />
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
                  {authorHandle}
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
        </header>
        {children}
        {postId ? <WorkbenchComments postId={postId} /> : null}
      </article>
    </main>
  );
}
