import { useEffect, useState } from 'react';

import { subscribeToTasks } from '@/hooks/useAction';

/**
 * Modern, luminous top task progress stream.
 * Smoothly activates whenever any action/task is executed across the admin portal,
 * streams vibrant brand gradients, and resolves smoothly with a 100% burst and fade-out.
 */
export function TopProgressBar() {
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return subscribeToTasks((count) => {
      if (count > 0) {
        setVisible(true);
        setActive(true);
        setProgress((prev) => (prev < 20 ? 30 : prev));
      } else {
        setActive(false);
        setProgress(100);
        const timer = window.setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 320);
        return () => window.clearTimeout(timer);
      }
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => {
      setProgress((p) => {
        if (p < 85) return p + Math.random() * 8 + 2;
        return p;
      });
    }, 180);
    return () => window.clearInterval(interval);
  }, [active]);

  if (!visible) return null;

  return (
    <div
      className={`portal-task-bar${active ? ' portal-task-bar--active' : ' portal-task-bar--complete'}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      aria-label="Performing background task"
    >
      <div
        className="portal-task-bar__fill"
        style={{
          width: `${progress}%`,
        }}
      />
    </div>
  );
}

