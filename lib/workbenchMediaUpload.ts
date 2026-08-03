/** Upload data-URL / blob media via signed Supabase URLs (avoids 413 on post save). */

function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { blob: new Blob([bytes], { type: contentType }), contentType };
}

async function uploadBlob(blob: Blob, contentType: string, folder: string) {
  const signResponse = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, folder }),
  });
  const signed = (await signResponse.json().catch(() => ({}))) as {
    error?: string;
    signedUrl?: string;
    token?: string;
    publicUrl?: string;
    path?: string;
  };
  if (!signResponse.ok || !signed.signedUrl || !signed.publicUrl) {
    throw new Error(signed.error || "Could not prepare media upload");
  }

  const uploadResponse = await fetch(signed.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      ...(signed.token ? { "x-upsert": "true" } : {}),
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Media upload failed (${uploadResponse.status})`);
  }

  return signed.publicUrl;
}

export async function hostDataUrl(
  value: string | null | undefined,
  folder = "media",
) {
  if (!value) return value ?? null;
  if (!value.startsWith("data:")) return value;
  const parsed = dataUrlToBlob(value);
  if (!parsed) return value;
  return uploadBlob(parsed.blob, parsed.contentType, folder);
}

export async function hostDataUrlsInHtml(html: string) {
  if (!html || !html.includes("data:")) return html;

  const matches = [...html.matchAll(/src=(["'])(data:[^"']+)\1/gi)];
  let next = html;
  for (const match of matches) {
    const dataUrl = match[2];
    try {
      const hosted = await hostDataUrl(dataUrl, "post-html");
      if (hosted && hosted !== dataUrl) {
        next = next.split(dataUrl).join(hosted);
      }
    } catch {
      // Keep original data URL if upload fails; save may still 413.
    }
  }
  return next;
}
