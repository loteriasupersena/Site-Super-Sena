"use client";

import { useEffect } from "react";

export function AndroidBrowserClass() {
  useEffect(() => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const root = document.documentElement;

    if (!isAndroid) return;

    root.classList.add("is-android");

    const visualViewport = window.visualViewport;
    const updateVisibleHeight = () => {
      const visibleHeight = visualViewport?.height ?? window.innerHeight;
      root.style.setProperty("--android-visible-height", `${Math.round(visibleHeight)}px`);
    };

    updateVisibleHeight();
    window.addEventListener("resize", updateVisibleHeight);
    window.addEventListener("orientationchange", updateVisibleHeight);
    visualViewport?.addEventListener("resize", updateVisibleHeight);

    return () => {
      window.removeEventListener("resize", updateVisibleHeight);
      window.removeEventListener("orientationchange", updateVisibleHeight);
      visualViewport?.removeEventListener("resize", updateVisibleHeight);
      root.classList.remove("is-android");
      root.style.removeProperty("--android-visible-height");
    };
  }, []);

  return null;
}
