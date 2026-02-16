'use client';

import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

const PASS = 'MATTHEWS123';
const STORAGE_KEY = 'om-tool-auth';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored === 'true') setAuthed(true);
      setChecking(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === PASS) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setAuthed(true);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  if (checking) return null;
  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div
        className={`bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 w-full max-w-sm shadow-2xl ${
          shake ? 'animate-shake' : ''
        }`}
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">OM Tool</h1>
          <p className="text-sm text-blue-200/60 mt-1">Enter team password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 text-sm"
          />
          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl transition-colors text-sm"
          >
            Enter
          </button>
        </form>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}
