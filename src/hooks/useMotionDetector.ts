import { useRef, useCallback, useEffect, useState } from "react";
import { getConfig } from "@/lib/config";

export function useMotionDetector() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [presenceDetected, setPresenceDetected] = useState(false);
  const lastPresenceAtRef = useRef<number>(0);
  const prevFrameRef = useRef<ImageData | null>(null);

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.warn("Camera API not available (requires HTTPS or localhost)");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      console.warn("Camera not available");
    }
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;  
    if (!video || !canvas || video.readyState < 2) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  }, []);

  // Lightweight local "presence" detector (motion-based) so we can trigger the
  // recognition model exactly once after a person appears.
  useEffect(() => {
    if (!cameraReady) return;

    const intervalMs = 150;
    const motionHoldMs = 2000;
    const { MOTION_SENSITIVITY } = getConfig();

    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const prev = prevFrameRef.current;
      prevFrameRef.current = current;
      if (!prev) return;

      // Sample pixels for speed (step of 16 bytes = 4 pixels).
      let sum = 0;
      let count = 0;
      const len = Math.min(prev.data.length, current.data.length);
      for (let i = 0; i < len; i += 16) {
        sum += Math.abs(current.data[i] - prev.data[i]);     // R
        sum += Math.abs(current.data[i + 1] - prev.data[i + 1]); // G
        sum += Math.abs(current.data[i + 2] - prev.data[i + 2]); // B
        count += 3;
      }

      const avgDiff = count ? sum / count : 0;
      // Lower threshold a bit so "face detected" triggers promptly.
      const threshold = Math.max(1.5, MOTION_SENSITIVITY / 8);
      const now = Date.now();

      if (avgDiff >= threshold) {
        lastPresenceAtRef.current = now;
        if (!presenceDetected) setPresenceDetected(true);
        return;
      }

      if (presenceDetected && now - lastPresenceAtRef.current > motionHoldMs) {
        setPresenceDetected(false);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [cameraReady, presenceDetected]);

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera]);

  return { videoRef, canvasRef, captureFrame, cameraReady, presenceDetected };
}
