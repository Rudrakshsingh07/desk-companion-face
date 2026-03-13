import { useState, useEffect, useRef, useCallback } from "react";
import { useMotionDetector } from "./useMotionDetector";
import { recognizeFace, logEvent } from "@/lib/api";
import { getConfig } from "@/lib/config";

export type AppState = "idle" | "locked" | "authenticated" | "login" | "admin";

export interface SessionAnalytics {
  totalDeskTimeMs: number;
  sessionCount: number;
  lastSeenTime: Date | null;
}

export function useAppState() {
  const { videoRef, canvasRef, captureFrame, cameraReady } = useMotionDetector();
  const [state, setState] = useState<AppState>("idle");
  const [userId, setUserId] = useState<string>("");
  const [analytics, setAnalytics] = useState<SessionAnalytics>({
    totalDeskTimeMs: 0,
    sessionCount: 0,
    lastSeenTime: null,
  });

  const lastActivityRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number | null>(null);
  const isRecognizingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRecognition = useCallback(async () => {
    if (isRecognizingRef.current) return;
    isRecognizingRef.current = true;

    try {
      const frame = captureFrame();
      if (!frame) return;

      const result = await recognizeFace(frame);
      if (!result) return;

      if (result.authenticated && result.user_id) {
        if (state !== "authenticated") {
          setState("authenticated");
          setUserId(result.user_id);
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
        if (state === "idle") {
          setState("locked");
          logEvent("auth_fail", result.user_id || "unknown");
        }
      }
    } finally {
      isRecognizingRef.current = false;
    }
  }, [captureFrame, state]);

  const triggerRecognition = useCallback(() => {
    if (cameraReady) {
      handleRecognition();
    }
  }, [cameraReady, handleRecognition]);

  const handleManualLogin = useCallback((loginUserId: string) => {
    setState("authenticated");
    setUserId(loginUserId);
    sessionStartRef.current = Date.now();
    lastActivityRef.current = Date.now();
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
  }, [userId]);

  const handleLock = useCallback(() => {
    setState("idle");
  }, []);

  const showAdmin = useCallback(() => setState("admin"), []);
  const backToDashboard = useCallback(() => setState("authenticated"), []);

  const showLogin = useCallback(() => setState("login"), []);
  const cancelLogin = useCallback(() => setState("idle"), []);
  const retryRecognition = useCallback(() => {
    setState("idle");
    setTimeout(() => triggerRecognition(), 500);
  }, [triggerRecognition]);
  const cancelLocked = useCallback(() => setState("idle"), []);

  // Run recognition when camera becomes ready
  useEffect(() => {
    if (cameraReady) {
      handleRecognition();
    }
  }, [cameraReady, handleRecognition]);

  // When idle and camera is ready, periodically try to recognize a face
  useEffect(() => {
    if (!cameraReady || state !== "idle") return;

    const interval = setInterval(() => {
      triggerRecognition();
    }, 3000);

    return () => clearInterval(interval);
  }, [cameraReady, state, triggerRecognition]);

  // Presence check — when authenticated, periodically check if a face is in frame
  useEffect(() => {
    if (state !== "authenticated") {
      if (presenceTimerRef.current) {
        clearInterval(presenceTimerRef.current);
        presenceTimerRef.current = null;
      }
      return;
    }

    let missCount = 0;
    presenceTimerRef.current = setInterval(async () => {
      const frame = captureFrame();
      if (!frame) return;

      try {
        const result = await recognizeFace(frame);
        if (result && result.authenticated) {
          missCount = 0;
          lastActivityRef.current = Date.now();
        } else {
          missCount++;
          // Lock after 3 consecutive misses (~9 seconds)
          if (missCount >= 3) {
            handleLogout();
          }
        }
      } catch {
        // ignore
      }
    }, 3000);

    return () => {
      if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
    };
  }, [state, captureFrame, handleLogout]);

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
      }
    }, 2000);

    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, [state, userId, handleLogout]);

  return {
    state, userId, analytics, videoRef, canvasRef, sessionStartRef,
    triggerRecognition, handleManualLogin, handleLogout, handleLock,
    showLogin, cancelLogin, retryRecognition, cancelLocked,
    showAdmin, backToDashboard,
  };
}
