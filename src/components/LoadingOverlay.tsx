'use client';

import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingOverlay({
  message = 'Loading...',
  fullScreen = false,
}: LoadingOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const overlay = (
    <div
      className={`flex flex-col items-center justify-center gap-4 z-50 ${
        fullScreen
          ? 'fixed inset-0 bg-black/60'
          : 'absolute inset-0 bg-white/80 rounded-lg'
      }`}
    >
      <Loader2
        className={`animate-spin ${
          fullScreen ? 'w-12 h-12 text-white' : 'w-8 h-8 text-blue-600'
        }`}
      />
      <p
        className={`text-sm font-medium ${
          fullScreen ? 'text-white' : 'text-gray-700'
        }`}
      >
        {message}
      </p>
    </div>
  );

  if (fullScreen) {
    if (!mounted) return null;
    return createPortal(overlay, document.body);
  }

  return overlay;
}
