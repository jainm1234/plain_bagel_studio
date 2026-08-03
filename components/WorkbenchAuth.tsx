"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useClerk, useSignIn, useUser } from "@clerk/nextjs";
import WorkbenchLoginModal from "@/components/WorkbenchLoginModal";

export type AuthProvider = "apple" | "google";

export type WorkbenchUser = {
  id: string;
  handle: string;
  displayName: string;
  email: string;
  provider: AuthProvider;
  createdAt: string;
};

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;

type AuthContextValue = {
  user: WorkbenchUser | null;
  ready: boolean;
  signIn: (provider: AuthProvider) => void;
  signOut: () => void;
  updateProfile: (
    patch: Partial<Pick<WorkbenchUser, "handle" | "displayName">>,
  ) => void;
  openLogin: (message?: string) => void;
  closeLogin: () => void;
};

const DEFAULT_LOGIN_MESSAGE = "log in";

const AuthContext = createContext<AuthContextValue | null>(null);

function sanitizeHandle(value: string, fallback: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 64) || fallback
  );
}

function handleKey(value: string) {
  return value.toLowerCase().replace(/[._-]/g, "");
}

function providerFromUser(user: ClerkUser): AuthProvider {
  const providers = user.externalAccounts.map(
    (account: { provider: string }) => account.provider,
  );
  if (providers.some((provider: string) => provider.includes("apple"))) {
    return "apple";
  }
  return "google";
}

function oauthUsername(user: ClerkUser) {
  for (const account of user.externalAccounts) {
    const username =
      typeof account.username === "string" ? account.username.trim() : "";
    if (username) return username;
  }
  return "";
}

function mapClerkUser(user: ClerkUser): WorkbenchUser {
  const metaHandle =
    typeof user.unsafeMetadata?.handle === "string"
      ? user.unsafeMetadata.handle.trim()
      : "";
  const emailLocal =
    user.primaryEmailAddress?.emailAddress?.split("@")[0] || "";
  const fallback = `user_${user.id.replace(/^user_/, "").slice(0, 8)}`;
  const emailHandle = emailLocal ? sanitizeHandle(emailLocal, "") : "";
  const accountHandle =
    emailHandle ||
    sanitizeHandle(
      user.username || oauthUsername(user) || fallback,
      fallback,
    );
  const savedHandle = metaHandle ? sanitizeHandle(metaHandle, "") : "";
  // Ignore stale saved handles that are just the email username with dots removed
  // (e.g. "malvikajain" vs "malvika.jain").
  const savedIsCustom =
    Boolean(savedHandle) &&
    handleKey(savedHandle) !== handleKey(accountHandle);
  const handle = savedIsCustom ? savedHandle : accountHandle;

  const metaDisplay =
    typeof user.unsafeMetadata?.displayName === "string"
      ? user.unsafeMetadata.displayName.trim()
      : "";
  const nameFromParts = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const displayName =
    metaDisplay ||
    user.fullName?.trim() ||
    nameFromParts ||
    user.firstName?.trim() ||
    handle;

  return {
    id: user.id,
    handle,
    displayName,
    email: user.primaryEmailAddress?.emailAddress?.trim() || "",
    provider: providerFromUser(user),
    createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
  };
}

export function WorkbenchAuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser();
  const clerk = useClerk();
  const { signIn: clerkSignIn } = useSignIn();
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMessage, setLoginMessage] = useState(DEFAULT_LOGIN_MESSAGE);
  const [signInError, setSignInError] = useState<string | null>(null);

  const user = useMemo(
    () => (clerkUser ? mapClerkUser(clerkUser) : null),
    [clerkUser],
  );

  // Keep Clerk metadata aligned with the live Workbench username.
  useEffect(() => {
    if (!clerkUser || !user?.handle) return;
    const saved =
      typeof clerkUser.unsafeMetadata?.handle === "string"
        ? clerkUser.unsafeMetadata.handle.trim().toLowerCase()
        : "";
    const next = user.handle.toLowerCase();
    if (saved === next) return;
    // Overwrite missing, truncated, or punctuation-stripped leftovers.
    if (
      saved &&
      handleKey(saved) !== handleKey(next) &&
      !(next.startsWith(saved) && next.length > saved.length)
    ) {
      return;
    }
    void clerkUser.update({
      unsafeMetadata: {
        ...clerkUser.unsafeMetadata,
        handle: user.handle,
      },
    });
  }, [clerkUser, user?.handle]);

  useEffect(() => {
    if (user && loginOpen) setLoginOpen(false);
  }, [user, loginOpen]);

  const closeLogin = useCallback(() => {
    setLoginOpen(false);
    setSignInError(null);
  }, []);

  const openLogin = useCallback((message?: string) => {
    setLoginMessage(message?.trim() || DEFAULT_LOGIN_MESSAGE);
    setSignInError(null);
    setLoginOpen(true);
  }, []);

  const signIn = useCallback(
    (provider: AuthProvider) => {
      if (!clerkSignIn) {
        setSignInError("sign-in isn’t ready yet. try again in a moment.");
        return;
      }

      setSignInError(null);
      const redirectCallbackUrl = `${window.location.origin}/sso-callback`;
      const redirectUrl = window.location.href;

      void clerkSignIn
        .sso({
          strategy: provider === "apple" ? "oauth_apple" : "oauth_google",
          redirectUrl,
          redirectCallbackUrl,
        })
        .then((result) => {
          if (result.error) {
            setSignInError(
              result.error.message ||
                "could not start sign-in. enable Google/Apple in the Clerk dashboard.",
            );
          }
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error
              ? error.message
              : "could not start sign-in. check Clerk social connections.";
          setSignInError(message);
        });
    },
    [clerkSignIn],
  );

  const signOut = useCallback(() => {
    void clerk.signOut().then(() => {
      window.location.assign("/work-bench");
    });
  }, [clerk]);

  const updateProfile = useCallback(
    (patch: Partial<Pick<WorkbenchUser, "handle" | "displayName">>) => {
      if (!clerkUser) return;
      const current = mapClerkUser(clerkUser);
      const nextHandle = sanitizeHandle(
        patch.handle ?? current.handle,
        current.handle,
      );
      const nextDisplayName =
        (patch.displayName ?? current.displayName).trim().slice(0, 40) ||
        current.displayName;

      void clerkUser.update({
        firstName: nextDisplayName,
        unsafeMetadata: {
          ...clerkUser.unsafeMetadata,
          handle: nextHandle,
          displayName: nextDisplayName,
        },
      });
    },
    [clerkUser],
  );

  const value = useMemo(
    () => ({
      user,
      ready: isLoaded,
      signIn,
      signOut,
      updateProfile,
      openLogin,
      closeLogin,
    }),
    [user, isLoaded, signIn, signOut, updateProfile, openLogin, closeLogin],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {loginOpen ? (
        <WorkbenchLoginModal
          message={loginMessage}
          error={signInError}
          onClose={closeLogin}
          onSignIn={signIn}
        />
      ) : null}
    </AuthContext.Provider>
  );
}

export function useWorkbenchAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useWorkbenchAuth must be used within WorkbenchAuthProvider");
  }
  return ctx;
}
