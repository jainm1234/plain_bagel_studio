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
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 24) || fallback
  );
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

function mapClerkUser(user: ClerkUser): WorkbenchUser {
  const metaHandle =
    typeof user.unsafeMetadata?.handle === "string"
      ? user.unsafeMetadata.handle
      : "";
  const emailLocal =
    user.primaryEmailAddress?.emailAddress?.split("@")[0] || "";
  const fallback = `user_${user.id.replace(/^user_/, "").slice(0, 8)}`;
  const handle = sanitizeHandle(
    metaHandle || user.username || emailLocal || fallback,
    fallback,
  );
  const displayName =
    user.fullName?.trim() ||
    user.firstName?.trim() ||
    (typeof user.unsafeMetadata?.displayName === "string"
      ? user.unsafeMetadata.displayName.trim()
      : "") ||
    handle;

  return {
    id: user.id,
    handle,
    displayName,
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
    void clerk.signOut();
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
