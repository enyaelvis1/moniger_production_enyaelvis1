import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const SESSION_TIMEOUT_STORAGE_KEY = "moniger-session-timeout-minutes";
const DEFAULT_SESSION_TIMEOUT_MINUTES = 20;
const MIN_SESSION_TIMEOUT_MINUTES = 1;
const MAX_SESSION_TIMEOUT_MINUTES = 120;

type SessionTimeoutContextValue = {
  sessionTimeoutMinutes: number;
  setSessionTimeoutMinutes: (minutes: number) => void;
};

const SessionTimeoutContext = createContext<SessionTimeoutContextValue>({
  sessionTimeoutMinutes: DEFAULT_SESSION_TIMEOUT_MINUTES,
  setSessionTimeoutMinutes: () => {},
});

const clampSessionTimeoutMinutes = (value: number) =>
  Math.min(MAX_SESSION_TIMEOUT_MINUTES, Math.max(MIN_SESSION_TIMEOUT_MINUTES, Math.round(value)));

const readStoredSessionTimeoutMinutes = () => {
  if (typeof window === "undefined") {
    return DEFAULT_SESSION_TIMEOUT_MINUTES;
  }

  const rawValue = window.localStorage.getItem(SESSION_TIMEOUT_STORAGE_KEY);
  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_SESSION_TIMEOUT_MINUTES;
  }

  return clampSessionTimeoutMinutes(parsedValue);
};

export const SessionTimeoutProvider = ({ children }: { children: ReactNode }) => {
  const [sessionTimeoutMinutes, setSessionTimeoutMinutesState] = useState<number>(readStoredSessionTimeoutMinutes);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== SESSION_TIMEOUT_STORAGE_KEY) {
        return;
      }

      setSessionTimeoutMinutesState(readStoredSessionTimeoutMinutes());
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const setSessionTimeoutMinutes = (minutes: number) => {
    const normalizedMinutes = clampSessionTimeoutMinutes(minutes);
    setSessionTimeoutMinutesState(normalizedMinutes);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_TIMEOUT_STORAGE_KEY, String(normalizedMinutes));
    }
  };

  return (
    <SessionTimeoutContext.Provider value={{ sessionTimeoutMinutes, setSessionTimeoutMinutes }}>
      {children}
    </SessionTimeoutContext.Provider>
  );
};

export const useSessionTimeout = () => useContext(SessionTimeoutContext);
