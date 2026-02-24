import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  API_UNAUTHORIZED_EVENT,
  AUTH_TOKEN_STORAGE_KEY,
  clearStoredAuthToken,
  getStoredAuthToken,
  setStoredAuthToken,
} from "../services/api";
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from "../services/auth";
import type { AuthUser } from "../types/api";

const AUTH_USER_STORAGE_KEY = "omari_branch_system_auth_user";

type AuthContextValue = {
  token: string;
  user: AuthUser | null;
  isReady: boolean;
  isAuthenticated: boolean;
  canWrite: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (
      typeof parsed.id === "string" &&
      typeof parsed.username === "string" &&
      (parsed.role === "VIEWER" || parsed.role === "FULL_ACCESS")
    ) {
      return {
        id: parsed.id,
        username: parsed.username,
        role: parsed.role,
      };
    }
  } catch {
    // Ignore invalid storage payloads.
  }

  return null;
}

function setStoredUser(user: AuthUser): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

function clearStoredUser(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  const clearSession = useCallback(() => {
    clearStoredAuthToken();
    clearStoredUser();
    setToken("");
    setUser(null);
  }, []);

  const storeSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    setStoredAuthToken(nextToken);
    setStoredUser(nextUser);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  useEffect(() => {
    const storedToken = getStoredAuthToken();
    if (!storedToken) {
      setIsReady(true);
      return;
    }

    setToken(storedToken);
    const storedUser = readStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }

    let isCancelled = false;

    void getCurrentUser()
      .then((currentUser) => {
        if (isCancelled) {
          return;
        }

        setStoredUser(currentUser);
        setUser(currentUser);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        clearSession();
      })
      .finally(() => {
        if (!isCancelled) {
          setIsReady(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await loginRequest({
        username: username.trim().toLowerCase(),
        password,
      });

      storeSession(result.token, result.user);
    },
    [storeSession],
  );

  const logout = useCallback(async () => {
    try {
      if (getStoredAuthToken()) {
        await logoutRequest();
      }
    } catch {
      // Ignore logout failures and clear local session state.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTH_TOKEN_STORAGE_KEY) {
        const nextToken = event.newValue?.trim() ?? "";
        setToken(nextToken);
        if (!nextToken) {
          setUser(null);
        }
      }

      if (event.key === AUTH_USER_STORAGE_KEY) {
        setUser(readStoredUser());
      }
    };

    window.addEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener("storage", handleStorage);
    };
  }, [clearSession]);

  const isAuthenticated = Boolean(token && user);
  const canWrite = user?.role === "FULL_ACCESS";

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isReady,
      isAuthenticated,
      canWrite,
      login,
      logout,
    }),
    [token, user, isReady, isAuthenticated, canWrite, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
