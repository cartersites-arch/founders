type Entry = { count: number; expires: number };

/** Bounded per-process fallback. A distributed edge limit is still required. */
export function createSubmissionLimiter(now: () => number = Date.now, capacity = 4096) {
  const entries = new Map<string, Entry>();
  return (key: string, limit: number, windowMs: number): boolean => {
    const time = now();
    for (const [name, entry] of entries) if (entry.expires <= time) entries.delete(name);
    let entry = entries.get(key);
    if (!entry) {
      if (entries.size >= capacity) return false;
      entry = { count: 0, expires: time + windowMs };
      entries.set(key, entry);
    }
    if (entry.count >= limit) return false;
    entry.count++;
    return true;
  };
}

export function validateSubmissionOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser callers still pass all rate limits.
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
