"use client";

import WorkbenchAccount from "@/components/WorkbenchAccount";
import WorkbenchComments from "@/components/WorkbenchComments";
import EditPostButton from "@/components/EditPostButton";
import DeletePostButton from "@/components/DeletePostButton";
import WorkbenchProjectCover from "@/components/WorkbenchProjectCover";
import WorkbenchProjectTitle from "@/components/WorkbenchProjectTitle";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  displayAuthorHandle,
  type WorkbenchPostDraft,
  type WorkbenchPostRelated,
} from "@/lib/workbenchPostEdits";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";

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
          <WorkbenchProjectTitle
            title={title}
            author={author}
            authorLabel={authorHandle}
            socialLink={socialLink}
            related={related}
          />
          {lead ? <p className="workbench-project-lead">{lead}</p> : null}
        </header>
        {children}
        {postId ? <WorkbenchComments postId={postId} /> : null}
      </article>
    </main>
  );
}
