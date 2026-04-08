const IOS_INSTALL_DISMISSED_KEY = "ios-install-prompt-dismissed";

export function isIPad(): boolean {
  if (typeof navigator === "undefined") return false;
  // 旧iPadOS: UAに "iPad" が含まれる
  if (/iPad/.test(navigator.userAgent)) return true;
  // iPadOS 13+: UAが "Macintosh" に変わるが maxTouchPoints > 1
  if (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) return true;
  return false;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPod/.test(navigator.userAgent)) return true;
  if (isIPad()) return true;
  return false;
}

export function isInStandaloneMode(): boolean {
  if (typeof navigator === "undefined") return false;
  // iOS Safari sets navigator.standalone when running as installed PWA
  if ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone) {
    return true;
  }
  // Fallback: check display-mode media query
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(display-mode: standalone)").matches;
  }
  return false;
}

export function shouldShowInstallPrompt(): boolean {
  if (!isIOS()) return false;
  if (isInStandaloneMode()) return false;
  if (typeof window !== "undefined" && window.localStorage?.getItem(IOS_INSTALL_DISMISSED_KEY)) {
    return false;
  }
  return true;
}

export function dismissInstallPrompt(): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(IOS_INSTALL_DISMISSED_KEY, "1");
  }
}
