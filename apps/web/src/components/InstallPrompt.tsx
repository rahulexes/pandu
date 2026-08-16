'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration note:', err);
      });
    }

    // Check if already in standalone app mode
    if (typeof window !== 'undefined') {
      const isApp = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isApp);

      // Check iOS
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIosDevice);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  if (isStandalone) return null;

  return (
    <>
      <AnimatePresence>
        {(isInstallable || (isIOS && !isStandalone)) && (
          <motion.div
            className="fixed top-3 right-3 z-50"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black tracking-wide shadow-lg shadow-amber-500/30 border border-amber-300 cursor-pointer transition-all hover:scale-105 active:scale-95"
            >
              <span className="text-sm">📲</span>
              <span>Install App</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Add to Home Screen Instructions Modal */}
      <AnimatePresence>
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              className="glass-strong rounded-2xl p-5 max-w-sm w-full border border-amber-400/50 shadow-2xl text-center space-y-3"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <div className="text-4xl">📱</div>
              <h3 className="text-base font-black text-amber-400">Install PANDU on iPhone / iPad</h3>
              <div className="text-xs text-slate-300 space-y-2 text-left bg-white/5 p-3.5 rounded-xl border border-white/10">
                <p className="flex items-center gap-2">
                  <span className="font-bold text-amber-300">1.</span> Tap the <span className="font-bold text-sky-400">Share button (⬆️)</span> in Safari.
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-bold text-amber-300">2.</span> Scroll down and tap <span className="font-bold text-emerald-400">"Add to Home Screen" (➕)</span>.
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-bold text-amber-300">3.</span> Launch PANDU from your Home Screen for full-screen app gameplay!
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full btn-primary py-2.5 text-xs font-black cursor-pointer"
              >
                Got It!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
