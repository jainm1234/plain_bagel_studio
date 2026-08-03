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
import WorkbenchLoginModal from "@/components/WorkbenchLoginModal";

export type AuthProvider = "apple" | "google";

export type WorkbenchUser = {
  id: string;
  handle: string;
  displayName: string;
  provider: AuthProvider;
  createdAt: string;
};

type AuthContextValue = {
  user: WorkbenchUser | null;
  ready: boolean;
  signIn: (provider: AuthProvider) => void;
  signOut: () => void;
  updateProfile: (patch: Partial<Pick<WorkbenchUser, "handle" | "displayName">>) => void;
  openLogin: (message?: string) => void;
  closeLogin: () => void;
};

const STORAGE_KEY = "workbench.user.v1";
const DEFAULT_LOGIN_MESSAGE = "log in";

const AuthContext = createContext<AuthContextValue | null>(null);

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `wb_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `wb_${Math.random().toString(36).slice(2, 10)}`;
}

function makeHandle(provider: AuthProvider) {
  const suffix = Math.random().toString(36).slice(2, 6);
  return provider === "apple" ? `apple_${suffix}` : `google_${suffix}`;
}

function readUser(): WorkbenchUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkbenchUser;
    if (!parsed?.id || !parsed?.handle) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeUser(user: WorkbenchUser | null) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function WorkbenchAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WorkbenchUser | null>(null);
  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMessage, setLoginMessage] = useState(DEFAULT_LOGIN_MESSAGE);

  useEffect(() => {
    setUser(readUser());
    setReady(true);
  }, []);

  const closeLogin = useCallback(() => {
    setLoginOpen(false);
  }, []);

  const openLogin = useCallback((message?: string) => {
    setLoginMessage(message?.trim() || DEFAULT_LOGIN_MESSAGE);
    setLoginOpen(true);
  }, []);

  const signIn = useCallback((provider: AuthProvider) => {
    const next: WorkbenchUser = {
      id: makeId(),
      handle: makeHandle(provider),
      displayName: provider === "apple" ? "apple user" : "google user",
      provider,
      createdAt: new Date().toISOString(),
    };
    writeUser(next);
    setUser(next);
    setLoginOpen(false);
  }, []);

  const signOut = useCallback(() => {
    writeUser(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    (patch: Partial<Pick<WorkbenchUser, "handle" | "displayName">>) => {
      setUser((current) => {
        if (!current) return current;
        const nextHandle = (patch.handle ?? current.handle)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 24) || current.handle;
        const knownId =
          nextHandle === "malvika" ? "wb_malvika" : current.id;
        const next = {
          ...current,
          ...patch,
          id: knownId,
          handle: nextHandle,
          displayName:
            (patch.displayName ?? current.displayName).trim().slice(0, 40) ||
            current.displayName,
        };
        writeUser(next);
        return next;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      ready,
      signIn,
      signOut,
      updateProfile,
      openLogin,
      closeLogin,
    }),
    [user, ready, signIn, signOut, updateProfile, openLogin, closeLogin],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {loginOpen ? (
        <WorkbenchLoginModal
          message={loginMessage}
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
