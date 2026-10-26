import { useState, useEffect } from "react";
import { formatDuration } from "../utils/formatDuration";

interface LiveTimerProps {
  startTime?: string;
  initialDuration: number;
  isActive?: boolean;
  className?: string;
}

export function LiveTimer({ startTime, initialDuration, isActive = false, className }: LiveTimerProps) {
  const [duration, setDuration] = useState(initialDuration);

  useEffect(() => {
    if (!isActive || !startTime) {
      setDuration(initialDuration);
      return;
    }

    const calcElapsed = () => {
      const startMs = new Date(startTime).getTime();
      return Math.max(1, Math.floor((Date.now() - startMs) / 1000));
    };

    let interval: ReturnType<typeof setInterval> | null = null;

    const startTimer = () => {
      if (interval) clearInterval(interval);
      setDuration(calcElapsed());
      interval = setInterval(() => {
        if (document.visibilityState !== "hidden") {
          setDuration(calcElapsed());
        }
      }, 1000);
    };

    const stopTimer = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        startTimer();
      } else {
        stopTimer();
      }
    };

    if (document.visibilityState !== "hidden") {
      startTimer();
    } else {
      setDuration(calcElapsed());
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [startTime, initialDuration, isActive]);

  return <span className={className}>{formatDuration(duration)}</span>;
}
