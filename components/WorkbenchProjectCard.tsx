"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import WorkbenchFireReaction from "@/components/WorkbenchFireReaction";
import WorkbenchProjectTitle from "@/components/WorkbenchProjectTitle";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";
import { displayAuthorHandle } from "@/lib/workbenchPostEdits";
import { postIdFromHref } from "@/lib/workbenchReactions";
import { socialPreviewSrc } from "@/lib/socialHints";

type Props = {
  title: string;
  href: string;
  image?: string;
  description?: string;
  socialLink?: string;
  comingSoon?: boolean;
  author?: {
    id: string;
    handle: string;
  };
};

export default function WorkbenchProjectCard({
  title,
  href,
  image,
  description,
  socialLink,
  comingSoon = false,
  author,
}: Props) {
  const { user } = useWorkbenchAuth();
  const authorHandle = displayAuthorHandle(user, author);
  const postId = postIdFromHref(href);
  const [socialFailed, setSocialFailed] = useState(false);

  const link = socialLink?.trim() || "";
  const socialSrc = link && !socialFailed ? socialPreviewSrc(link) : "";
  const previewSrc = socialSrc || image || "";
  const usingSocial = Boolean(socialSrc);

  const mediaInner = previewSrc ? (
    usingSocial || /^https?:\/\//i.test(previewSrc) ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewSrc}
        alt=""
        className="workbench-card-img"
        onError={() => {
          if (usingSocial) setSocialFailed(true);
        }}
      />
    ) : (
      <Image
        src={previewSrc}
        alt=""
        width={800}
        height={600}
        className="workbench-card-img"
      />
    )
  ) : null;

  return (
    <article
      className={
        comingSoon ? "workbench-card workbench-card--soon" : "workbench-card"
      }
    >
      <div className="workbench-card-media">
        {previewSrc ? (
          comingSoon ? (
            <div className="workbench-card-image">{mediaInner}</div>
          ) : (
            <Link href={href} className="workbench-card-image">
              {mediaInner}
            </Link>
          )
        ) : comingSoon ? (
          <div
            className="workbench-card-image workbench-card-image--placeholder"
            aria-hidden="true"
          />
        ) : (
          <Link
            href={href}
            className="workbench-card-image workbench-card-image--placeholder"
            aria-label={`${title} image placeholder`}
          />
        )}
      </div>

      <div className="workbench-card-body">
        <WorkbenchProjectTitle
          tone="card"
          title={title}
          titleHref={comingSoon ? undefined : href}
          comingSoon={comingSoon}
          author={author}
          authorLabel={authorHandle}
          socialLink={socialLink}
        />

        {description ? (
          <p className="workbench-card-description">{description}</p>
        ) : null}

        {!comingSoon ? (
          <div className="workbench-card-engage">
            <WorkbenchFireReaction postId={postId} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
