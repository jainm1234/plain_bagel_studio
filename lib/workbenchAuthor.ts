import { auth, currentUser } from "@clerk/nextjs/server";

function usernameFromEmail(email: string | undefined) {
  if (!email) return "";
  const local = email.split("@")[0]?.trim() || "";
  return local.toLowerCase();
}

/** Resolve the signed-in Workbench author from Clerk (server-only). */
export async function resolveWorkbenchAuthor() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress;
  const handle =
    usernameFromEmail(email) ||
    user?.username ||
    user?.firstName?.toLowerCase() ||
    "user";
  return { id: userId, handle };
}

export function sameAuthorHandle(a: string, b: string) {
  return (
    a.replace(/[._-]/g, "").toLowerCase() ===
    b.replace(/[._-]/g, "").toLowerCase()
  );
}
