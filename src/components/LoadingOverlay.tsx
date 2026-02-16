'use client';

import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface ProgressStep {
  message: string;
  timestamp: Date;
}

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
  steps?: ProgressStep[];
}

export default function LoadingOverlay({
  message = 'Loading...',
  fullScreen = false,
  steps = [],
}: LoadingOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const overlay = (
    <div
      className={`flex flex-col items-center justify-center gap-4 z-50 ${
        fullScreen
          ? 'fixed inset-0 bg-black/70 backdrop-blur-sm'
          : 'absolute inset-0 bg-white/80 rounded-lg'
      }`}
    >
      <div className={`flex flex-col items-center gap-4 ${fullScreen ? 'max-w-md w-full px-6' : ''}`}>
        <Loader2
          className={`animate-spin ${
            fullScreen ? 'w-10 h-10 text-blue-400' : 'w-8 h-8 text-blue-600'
          }`}
        />
        <p
          className={`text-sm font-medium ${
            fullScreen ? 'text-white' : 'text-gray-700'
          }`}
        >
          {message}
        </p>

        {fullScreen && steps.length > 0 && (
          <div className="w-full mt-2 bg-black/40 rounded-xl border border-white/10 p-4 max-h-64 overflow-y-auto">
            <div className="space-y-1.5">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-xs font-mono transition-opacity duration-300 ${
                    i === steps.length - 1 ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  <span className="text-gray-500 flex-shrink-0">{formatTime(step.timestamp)}</span>
                  <span>{step.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (fullScreen) {
    if (!mounted) return null;
    return createPortal(overlay, document.body);
  }

  return overlay;
}
