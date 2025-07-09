'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import { BiX, BiDownload, BiMobile, BiDesktop } from 'react-icons/bi';
import { FaApple, FaAndroid, FaWindows } from 'react-icons/fa';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<string>('');
  const [installMethod, setInstallMethod] = useState<'browser' | 'manual'>('browser');

  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      // Check if running as standalone PWA
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      
      // Check if already installed (iOS Safari)
      if ((navigator as any).standalone === true) {
        setIsInstalled(true);
        return;
      }
      
      // Check if prompt was previously dismissed
      const dismissedDate = localStorage.getItem('pwa-install-dismissed');
      if (dismissedDate) {
        const daysSinceDismissed = (Date.now() - parseInt(dismissedDate)) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) { // Don't show again for 7 days
          return;
        }
      }
      
      setIsInstalled(false);
    };

    // Detect platform
    const detectPlatform = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      
      if (/iphone|ipad|ipod/.test(userAgent)) {
        setPlatform('ios');
        setInstallMethod('manual');
      } else if (/android/.test(userAgent)) {
        setPlatform('android');
        setInstallMethod('browser');
      } else if (/windows/.test(userAgent)) {
        setPlatform('windows');
        setInstallMethod('browser');
      } else if (/macintosh|mac os x/.test(userAgent)) {
        setPlatform('macos');
        setInstallMethod('browser');
      } else {
        setPlatform('desktop');
        setInstallMethod('browser');
      }
    };

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallMethod('browser');
      
      // Show prompt after a delay to avoid being intrusive
      setTimeout(() => {
        if (!isInstalled) {
          setShowPrompt(true);
        }
      }, 10000); // Show after 10 seconds
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      
      // Track installation
      if (typeof (window as any).gtag !== 'undefined') {
        (window as any).gtag('event', 'pwa_install', {
          event_category: 'engagement',
          event_label: platform
        });
      }
    };

    checkInstalled();
    detectPlatform();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled, platform]);

  const handleInstallClick = async () => {
    if (installMethod === 'browser' && deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          setIsInstalled(true);
          setShowPrompt(false);
        }
        
        setDeferredPrompt(null);
      } catch (error) {
        console.error('Install prompt failed:', error);
      }
    } else {
      // Show manual install instructions
      setInstallMethod('manual');
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    
    // Track dismissal
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('event', 'pwa_install_dismissed', {
        event_category: 'engagement',
        event_label: platform
      });
    }
  };

  const getPlatformIcon = () => {
    switch (platform) {
      case 'ios': return FaApple;
      case 'android': return FaAndroid;
      case 'windows': return FaWindows;
      default: return BiDesktop;
    }
  };

  const getInstallInstructions = () => {
    switch (platform) {
      case 'ios':
        return {
          title: 'Install MySetlist on iPhone/iPad',
          steps: [
            'Tap the Share button in Safari',
            'Scroll down and tap "Add to Home Screen"',
            'Tap "Add" in the top right corner',
            'MySetlist will appear on your home screen'
          ]
        };
      case 'android':
        return {
          title: 'Install MySetlist on Android',
          steps: [
            'Tap the menu (⋮) in Chrome',
            'Select "Add to Home screen"',
            'Tap "Add" to confirm',
            'MySetlist will appear on your home screen'
          ]
        };
      default:
        return {
          title: 'Install MySetlist',
          steps: [
            'Look for the install icon in your browser\'s address bar',
            'Click the install button when prompted',
            'Follow your browser\'s installation steps',
            'MySetlist will be available as a desktop app'
          ]
        };
    }
  };

  if (isInstalled || !showPrompt) return null;

  const PlatformIcon = getPlatformIcon();
  const instructions = getInstallInstructions();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50"
      >
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg shadow-xl border border-green-500/20 overflow-hidden">
          {/* Header */}
          <div className="p-4 pb-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <PlatformIcon size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Install MySetlist</h3>
                  <p className="text-sm text-green-100">
                    Get the full app experience
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 text-green-100 hover:text-white transition-colors"
                aria-label="Dismiss install prompt"
              >
                <BiX size={20} />
              </button>
            </div>
          </div>

          {/* Benefits */}
          <div className="px-4 py-2">
            <ul className="space-y-1 text-sm text-green-100">
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-green-200 rounded-full" />
                <span>Faster loading and offline access</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-green-200 rounded-full" />
                <span>Push notifications for your artists</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-green-200 rounded-full" />
                <span>Full-screen experience</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="p-4 pt-2">
            {installMethod === 'browser' && deferredPrompt ? (
              <div className="flex gap-2">
                <button
                  onClick={handleInstallClick}
                  className={twMerge(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-3",
                    "bg-white text-green-600 font-semibold rounded-lg",
                    "hover:bg-green-50 transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-white/50"
                  )}
                >
                  <BiDownload size={20} />
                  Install App
                </button>
                <button
                  onClick={handleDismiss}
                  className={twMerge(
                    "px-4 py-3 text-green-100 hover:text-white",
                    "transition-colors text-sm font-medium"
                  )}
                >
                  Later
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-white/10 rounded-lg p-3">
                  <h4 className="font-medium text-white mb-2 text-sm">
                    {instructions.title}
                  </h4>
                  <ol className="space-y-1 text-xs text-green-100">
                    {instructions.steps.map((step, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-4 h-4 bg-white/20 rounded-full flex items-center justify-center text-xs font-medium text-white">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <button
                  onClick={handleDismiss}
                  className="w-full py-2 text-green-100 hover:text-white transition-colors text-sm font-medium"
                >
                  Got it, thanks!
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};