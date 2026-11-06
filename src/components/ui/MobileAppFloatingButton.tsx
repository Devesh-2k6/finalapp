"use client";

import React, { useState, useEffect } from "react";
import { Smartphone } from "lucide-react";
import { MobileConnectModal } from "./MobileConnectModal";

export function MobileAppFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [hideInApp, setHideInApp] = useState(false);

  useEffect(() => {
    // Hide inside ReactNative WebView or mobile app environments
    if (
      typeof window !== "undefined" &&
      ((window as any).ReactNativeWebView ||
        navigator.userAgent.includes("wv") ||
        window.location.search.includes("app=true"))
    ) {
      setHideInApp(true);
    }
  }, []);

  if (hideInApp) return null;

  return (
    <>
      <div className="fixed bottom-20 lg:bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2 px-3.5 py-2 bg-zinc-900/95 hover:bg-zinc-900 border border-zinc-700/80 hover:border-purple-500/60 text-white rounded-full shadow-lg shadow-purple-950/20 backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-200 cursor-pointer hover:scale-105 active:scale-95 touch-manipulation"
          title="Connect Mobile App (Expo Go / APK)"
        >
          <Smartphone className="w-3.5 h-3.5 text-purple-400 group-hover:rotate-6 transition-transform duration-200" />
          <span className="text-[11px] font-semibold tracking-tight">
            Mobile App
          </span>
        </button>
      </div>

      <MobileConnectModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
