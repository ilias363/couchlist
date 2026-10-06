function isAppPage(path: string) {
  const pathname = path.split(/[?#]/, 1)[0];
  // Only known app routes may be saved or passed to router.replace.
  return /^\/(?:home|search|settings|stats|tv-status|movies(?:\/[1-9]\d*)?|tv-series(?:\/catch-up|\/[1-9]\d*(?:\/season\/\d+)?)?)$/.test(pathname);
}

/** Returns a destination only for an icon launch; ordinary visits just save their URL. */
export function syncLastPage(path: string, userId: string): string | null {
  const launching = path.split(/[?#]/, 1)[0] === "/launch";
  const key = `couchlist:last-page:${userId}`;

  try {
    if (launching) {
      const saved = localStorage.getItem(key);
      return saved && isAppPage(saved) ? saved : "/home";
    }
    if (isAppPage(path)) localStorage.setItem(key, path);
  } catch {
    // Storage can be blocked or full; navigation must still work.
  }

  return launching ? "/home" : null;
}
