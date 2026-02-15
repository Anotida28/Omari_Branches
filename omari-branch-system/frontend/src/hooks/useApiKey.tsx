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
  API_KEY_STORAGE_KEY,
  API_UNAUTHORIZED_EVENT,
  clearStoredApiKey,
  getStoredApiKey,
  setStoredApiKey,
} from "../services/api";

type ApiKeyContextValue = {
  apiKey: string;
  isReady: boolean;
  setApiKey: (value: string) => void;
  clearApiKey: () => void;
};

const ApiKeyContext = createContext<ApiKeyContextValue | undefined>(undefined);

type ApiKeyProviderProps = {
  children: ReactNode;
};

export function ApiKeyProvider({ children }: ApiKeyProviderProps) {
  const [apiKey, setApiKeyState] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setApiKeyState(getStoredApiKey());
    setIsReady(true);
  }, []);

  const clearApiKey = useCallback(() => {
    clearStoredApiKey();
    setApiKeyState("");
  }, []);

  const setApiKey = useCallback((value: string) => {
    const normalized = value.trim();
    setStoredApiKey(normalized);
    setApiKeyState(normalized);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearApiKey();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === API_KEY_STORAGE_KEY) {
        setApiKeyState(event.newValue?.trim() ?? "");
      }
    };

    window.addEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener("storage", handleStorage);
    };
  }, [clearApiKey]);

  const value = useMemo<ApiKeyContextValue>(
    () => ({ apiKey, isReady, setApiKey, clearApiKey }),
    [apiKey, isReady, setApiKey, clearApiKey],
  );

  return <ApiKeyContext.Provider value={value}>{children}</ApiKeyContext.Provider>;
}

export function useApiKey(): ApiKeyContextValue {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error("useApiKey must be used within ApiKeyProvider");
  }
  return context;
}
