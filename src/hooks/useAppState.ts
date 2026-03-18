import { useState, useEffect, useRef, useCallback } from "react";
import { useMotionDetector } from "./useMotionDetector";
import { recognizeFace, logEvent } from "@/lib/api";
import { getConfig } from "@/lib/config";

export type AppState = "idle" | "locked" | "authenticated" | "login" | "admin";
export type SessionRole = "admin" | "user";

export interface SessionAnalytics {
  totalDeskTimeMs: number;
  sessionCount: number;
  lastSeenTime: Date | null;
}

export function useAppState() {
  const { videoRef, canvasRef, captureFrame, cameraReady, presenceDetected } = useMotionDetector();
  const [state, setState] = useState<AppState>("idle");
  const [userId, setUserId] = useState<string>("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState<SessionRole | null>(null);
  const [analytics, setAnalytics] = useState<SessionAnalytics>({
    totalDeskTimeMs: 0,
    sessionCount: 0,
    lastSeenTime: null,
  });

  const lastActivityRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number | null>(null);
  const isRecognizingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriedForCurrentPresenceRef = useRef(false);
  const recognizeAbortRef = useRef<AbortController | null>(null);

  const getFrameWithRetries = useCallback(async (attempts: number, delayMs: number) => {
    for (let i = 0; i < attempts; i++) {
      const frame = captureFrame();
      if (frame) return frame;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return null;
  }, [captureFrame]);

  const handleRecognitionOnce = useCallback(async (opts?: { allowWhenAuthenticated?: boolean }) => {
    if (isRecognizingRef.current) return;
    if (!opts?.allowWhenAuthenticated && state === "authenticated") return;
    if (!cameraReady) return;
    isRecognizingRef.current = true;

    try {
      // Cancel any stuck recognition call so Retry feels responsive.
      if (recognizeAbortRef.current) recognizeAbortRef.current.abort();
      const abort = new AbortController();
      recognizeAbortRef.current = abort;

      const frame = await getFrameWithRetries(6, 120);
      if (!frame) return false;

      const result = await recognizeFace(frame, { signal: abort.signal, timeoutMs: 6000 });
      if (!result) return true;

      if (result.authenticated && result.user_id) {
        if (state !== "authenticated") {
          setState("authenticated");
          setUserId(result.user_id);
          setSessionToken(result.token ?? null);
          setSessionRole((result.role as SessionRole) ?? "user");
          sessionStartRef.current = Date.now();
          setAnalytics((prev) => ({
            ...prev,
            sessionCount: prev.sessionCount + 1,
            lastSeenTime: new Date(),
          }));
          logEvent("auth_success", result.user_id);
        }
        lastActivityRef.current = Date.now();
      } else {
        if (state === "idle" || state === "locked") {
          setState("locked");
          logEvent("auth_fail", result.user_id || "unknown");
        }
      }
      return true;
    } finally {
      isRecognizingRef.current = false;
      recognizeAbortRef.current = null;
    }
  }, [cameraReady, getFrameWithRetries, state]);

  const triggerRecognition = useCallback(() => {
    handleRecognitionOnce();
  }, [handleRecognitionOnce]);

  const handleManualLogin = useCallback((loginUserId: string, token: string, role: SessionRole) => {
    setState("authenticated");
    setUserId(loginUserId);
    setSessionToken(token);
    setSessionRole(role);
    sessionStartRef.current = Date.now();
    lastActivityRef.current = Date.now();
    hasTriedForCurrentPresenceRef.current = false;
    setAnalytics((prev) => ({
      ...prev,
      sessionCount: prev.sessionCount + 1,
      lastSeenTime: new Date(),
    }));
    logEvent("auth_success", loginUserId);
  }, []);

  const handleLogout = useCallback(() => {
    const sessionDuration = sessionStartRef.current
      ? Date.now() - sessionStartRef.current
      : 0;
    setAnalytics((prev) => ({
      ...prev,
      totalDeskTimeMs: prev.totalDeskTimeMs + sessionDuration,
      lastSeenTime: new Date(),
    }));
    logEvent("session_end", userId);
    sessionStartRef.current = null;
    setState("idle");
    setUserId("");
    setSessionToken(null);
    setSessionRole(null);
    hasTriedForCurrentPresenceRef.current = false;
  }, [userId]);

  const handleLock = useCallback(() => {
    setState("idle");
    hasTriedForCurrentPresenceRef.current = false;
  }, []);

  const showAdmin = useCallback(() => setState("admin"), []);
  const backToDashboard = useCallback(() => setState("authenticated"), []);

  const showLogin = useCallback(() => setState("login"), []);
  const cancelLogin = useCallback(() => {
    setState("idle");
    hasTriedForCurrentPresenceRef.current = false;
  }, []);
  const retryRecognition = useCallback(() => {
    // Important: do NOT go back to idle here, otherwise the idle polling will
    // start spamming recognition attempts. Retry should run exactly once.
    hasTriedForCurrentPresenceRef.current = true;
    void handleRecognitionOnce();
  }, [handleRecognitionOnce]);
  const cancelLocked = useCallback(() => {
    setState("idle");
    hasTriedForCurrentPresenceRef.current = false;
  }, []);

  // Flow requirement:
  // Static (idle) -> Face detected (local presence) -> Run recognition ONCE.
  // After that, recognition only runs again if user explicitly presses Retry.
  useEffect(() => {
    if (state !== "idle") return;
    if (!cameraReady) return;
    if (!presenceDetected) return;
    if (hasTriedForCurrentPresenceRef.current) return;

    void (async () => {
      const attempted = await handleRecognitionOnce();
      // Only "consume" the one automatic attempt if we actually captured a frame
      // and started the recognition call. Otherwise, keep waiting.
      if (attempted) hasTriedForCurrentPresenceRef.current = true;
    })();
  }, [state, cameraReady, presenceDetected, handleRecognitionOnce]);

  // When presence disappears, allow a new automatic attempt next time.
  useEffect(() => {
    if (state !== "idle") return;
    if (presenceDetected) return;
    hasTriedForCurrentPresenceRef.current = false;
  }, [state, presenceDetected]);

  // Session timeout
  useEffect(() => {
    idleTimerRef.current = setInterval(() => {
      const timeout = getConfig().SESSION_TIMEOUT_SECONDS * 1000;
      const elapsed = Date.now() - lastActivityRef.current;

      if (state === "authenticated" && elapsed > timeout) {
        handleLogout();
      }

      if (state === "locked" && elapsed > 10000) {
        setState("idle");
        hasTriedForCurrentPresenceRef.current = false;
      }
    }, 2000);

    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, [state, userId, handleLogout]);

  return {
    state, userId, sessionToken, sessionRole,
    analytics, videoRef, canvasRef, sessionStartRef,
    triggerRecognition, handleManualLogin, handleLogout, handleLock,
    showLogin, cancelLogin, retryRecognition, cancelLocked,
    showAdmin, backToDashboard,
  };
}
