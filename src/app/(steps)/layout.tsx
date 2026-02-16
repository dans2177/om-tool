'use client';

import { usePathname } from 'next/navigation';
import { OMProvider } from '@/context/OMContext';
import { FileUp, Images, ClipboardCheck } from 'lucide-react';

const steps = [
  { path: '/upload', label: 'Upload', icon: FileUp },
  { path: '/approval', label: 'Images', icon: Images },
  { path: '/review', label: 'Review', icon: ClipboardCheck },
] as const;

export default function StepsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const currentIdx = steps.findIndex((s) => pathname.startsWith(s.path));

  return (
    <OMProvider>
      <div className="min-h-screen bg-gray-50/50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">
              OM Tool
            </h1>

            {/* Step indicators */}
            <div className="flex items-center gap-1">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const isCurrent = i === currentIdx;
                const isPast = i < currentIdx;
                return (
                  <div key={s.path} className="flex items-center">
                    {i > 0 && (
                      <div className={`w-8 h-px mx-1 ${isPast ? 'bg-blue-300' : 'bg-gray-200'}`} />
                    )}
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isCurrent
                          ? 'bg-blue-50 text-blue-700'
                          : isPast
                          ? 'text-blue-500'
                          : 'text-gray-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="px-6 py-8">
          {children}
        </main>
      </div>
    </OMProvider>
  );
}
