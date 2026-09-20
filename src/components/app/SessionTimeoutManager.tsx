import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useSessionTimeout } from "@/contexts/SessionTimeoutContext";

const INACTIVITY_EVENTS = ["click", "keydown", "mousemove", "scroll", "touchstart"];
const WARNING_LEAD_MS = 60 * 1000;
const MIN_WARNING_LEAD_MS = 15 * 1000;
const CHECK_INTERVAL_MS = 1000;

const SessionTimeoutManager = () => {
  const { loading, session, signOut } = useAuth();
  const { sessionTimeoutMinutes } = useSessionTimeout();
  const navigate = useNavigate();
  const [warningVisible, setWarningVisible] = useState(false);
  const lastActivityAtRef = useRef<number>(Date.now());
  const hasTimedOutRef = useRef(false);
  const hasShownWarningRef = useRef(false);

  useEffect(() => {
    const isAuthenticated = Boolean(session?.user?.id);

    if (loading || !isAuthenticated) {
      setWarningVisible(false);
      return;
    }

    const totalTimeoutMs = sessionTimeoutMinutes * 60 * 1000;
    const warningAfterMs =
      totalTimeoutMs > WARNING_LEAD_MS
        ? totalTimeoutMs - WARNING_LEAD_MS
        : Math.max(MIN_WARNING_LEAD_MS, Math.floor(totalTimeoutMs / 2));

    const markActivity = () => {
      lastActivityAtRef.current = Date.now();
      hasTimedOutRef.current = false;
      hasShownWarningRef.current = false;
      setWarningVisible(false);
    };

    markActivity();

    const intervalId = window.setInterval(() => {
      const inactiveMs = Date.now() - lastActivityAtRef.current;

      if (!hasShownWarningRef.current && inactiveMs >= warningAfterMs) {
        hasShownWarningRef.current = true;
        setWarningVisible(true);
      }

      if (hasTimedOutRef.current || inactiveMs < totalTimeoutMs) {
        return;
      }

      hasTimedOutRef.current = true;
      void signOut("local").finally(() => {
        navigate("/login", {
          replace: true,
          state: { message: `Your session expired after ${sessionTimeoutMinutes} minute${sessionTimeoutMinutes === 1 ? "" : "s"} of inactivity.` },
        });
      });
    }, CHECK_INTERVAL_MS);

    INACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, { passive: true });
    });

    return () => {
      window.clearInterval(intervalId);
      INACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
    };
  }, [loading, navigate, session?.user?.id, sessionTimeoutMinutes, signOut]);

  return (
    <Dialog open={warningVisible} onOpenChange={setWarningVisible}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Session expiring soon</DialogTitle>
          <DialogDescription>
            For security, we sign you out after {sessionTimeoutMinutes} minute{sessionTimeoutMinutes === 1 ? "" : "s"} of
            inactivity. Interact with the app or choose an option below to continue safely.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setWarningVisible(false);
              void signOut("local").finally(() => {
                navigate("/login", {
                  replace: true,
                  state: { message: "You signed out before the inactivity timeout." },
                });
              });
            }}
          >
            Sign out now
          </Button>
          <Button type="button" onClick={() => setWarningVisible(false)}>
            Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SessionTimeoutManager;
