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
  type WorkbenchPostRelated,
} from "@/lib/workbenchPostEdits";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";
import { socialPlatformLabel } from "@/lib/socialHints";

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
  related?: WorkbenchPostRelated[];
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
  related = [],
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
                  {socialPlatformLabel(socialLink)}
                </a>
              </>
            ) : null}
          </h1>
          {lead ? <p className="workbench-project-lead">{lead}</p> : null}
          {related.length > 0 ? (
            <p className="workbench-project-related">
              <span className="workbench-project-by">references </span>
              {related.map((item, index) => (
                <span key={item.href}>
                  {index > 0 ? ", " : null}
                  <Link className="workbench-project-social" href={item.href}>
                    {item.title}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </header>
        {children}
        {postId ? <WorkbenchComments postId={postId} /> : null}
      </article>
    </main>
  );
}
