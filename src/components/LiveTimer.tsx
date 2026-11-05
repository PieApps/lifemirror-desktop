import { useState, useEffect } from "react";
import { formatDuration } from "../utils/formatDuration";

interface LiveTimerProps {
  startTime?: string;
  activeStartTime?: string;
  initialDuration: number;
  isActive?: boolean;
  className?: string;
}

export function LiveTimer({ startTime, activeStartTime, initialDuration, isActive = false, className }: LiveTimerProps) {
  const [duration, setDuration] = useState(initialDuration);

  useEffect(() => {
    if (!isActive) {
      setDuration(initialDuration);
      return;
    }

    const mountTime = Date.now();

    const calcElapsed = () => {
      const secondsSinceMount = Math.max(0, Math.floor((Date.now() - mountTime) / 1000));
      return initialDuration + secondsSinceMount;
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
  }, [startTime, activeStartTime, initialDuration, isActive]);

  return <span className={className}>{formatDuration(duration)}</span>;
}
