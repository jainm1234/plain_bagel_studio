"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import type { WorkbenchPostRelated } from "@/lib/workbenchPostEdits";
import { socialPlatformLabel } from "@/lib/socialHints";

type Author = {
  id: string;
  handle: string;
};

type Props = {
  title: string;
  /** Visual class prefix: project pages vs feed cards. */
  tone?: "project" | "card";
  author?: Author | null;
  authorLabel?: string;
  socialLink?: string;
  related?: WorkbenchPostRelated[];
  titleHref?: string;
  comingSoon?: boolean;
  onSocialClick?: (event: MouseEvent) => void;
  onRelatedClick?: (event: MouseEvent) => void;
};

function By() {
  return <span className="workbench-title-by">by</span>;
}

function On() {
  return <span className="workbench-title-by">on</span>;
}

function Referencing() {
  return <span className="workbench-title-by">referencing</span>;
}

/**
 * Shared title line: "name by handle on instagram referencing other-post"
 */
export default function WorkbenchProjectTitle({
  title,
  tone = "project",
  author,
  authorLabel,
  socialLink,
  related = [],
  titleHref,
  comingSoon = false,
  onSocialClick,
  onRelatedClick,
}: Props) {
  const titleClass =
    tone === "card" ? "workbench-card-title" : "workbench-project-title";
  const authorClass =
    tone === "card" ? "workbench-card-author" : "workbench-project-author";
  const socialClass =
    tone === "card" ? "workbench-card-social" : "workbench-project-social";
  const handle = authorLabel || author?.handle || "";

  let titleNode: ReactNode = title;
  if (comingSoon) {
    titleNode = (
      <span>
        {title}
        <span className="workbench-card-soon"> coming soon</span>
      </span>
    );
  } else if (titleHref) {
    titleNode = <Link href={titleHref}>{title}</Link>;
  }

  const TitleTag = tone === "card" ? "h2" : "h1";

  return (
    <TitleTag className={titleClass}>
      {titleNode}
      {author && handle ? (
        <>
          {" "}
          <By />{" "}
          <Link href={`/work-bench/u/${author.id}`} className={authorClass}>
            {handle}
          </Link>
        </>
      ) : null}
      {socialLink?.trim() ? (
        <>
          {" "}
          <On />{" "}
          <a
            className={socialClass}
            href={socialLink.trim()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onSocialClick}
          >
            {socialPlatformLabel(socialLink)}
          </a>
        </>
      ) : null}
      {related.length > 0 ? (
        <>
          {" "}
          <Referencing />{" "}
          {related.map((item, index) => (
            <span key={item.href}>
              {index > 0 ? <span className="workbench-title-by">, </span> : null}
              <Link
                className={socialClass}
                href={item.href}
                onClick={onRelatedClick}
              >
                {item.title}
              </Link>
            </span>
          ))}
        </>
      ) : null}
    </TitleTag>
  );
}
