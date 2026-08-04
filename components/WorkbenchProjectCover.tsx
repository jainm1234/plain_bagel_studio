"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import { socialPreviewSrc } from "@/lib/socialHints";

type Props = {
  coverImage?: string | null;
  socialLink?: string;
  title?: string;
  empty?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
};

export default function WorkbenchProjectCover({
  coverImage,
  socialLink,
  title = "project cover",
  empty = false,
  onClick,
}: Props) {
  const link = socialLink?.trim() || "";
  const [failed, setFailed] = useState(false);
  const socialSrc = !coverImage && link && !failed ? socialPreviewSrc(link) : "";
  const src = coverImage || socialSrc;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="workbench-project-cover"
        src={src}
        alt={title}
        onClick={onClick}
        onError={() => setFailed(true)}
      />
    );
  }

  if (empty || link) {
    return (
      <div
        className="workbench-project-cover workbench-project-cover--empty"
        aria-hidden="true"
        onClick={onClick}
      />
    );
  }

  return null;
}
