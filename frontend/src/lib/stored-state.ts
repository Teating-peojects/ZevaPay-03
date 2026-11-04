"use client";

/**
 * A tiny external store for values kept in `localStorage`.
 *
 * React's `useSyncExternalStore` needs a subscribe function, a snapshot
 * reader, and a server snapshot. Reading `localStorage` inside an effect and
 * calling `setState` there causes a cascading render, which the React
 * compiler's lint rules rightly reject. This module keeps the storage key
 * and its listeners in one place so a component can subscribe to it the same
 * way it subscribes to any other external system.
 */

/** Listeners waiting for a change to a given key. */
const listeners = new Map<string, Set<() => void>>();

/** Notifies everyone watching a key that it has changed. */
function notify(key: string) {
  const set = listeners.get(key);
  if (!set) return;
  for (const listener of set) listener();
}

/**
 * Subscribes to changes to a stored key.
 *
 * The returned function unsubscribes.
 */
export function subscribeToStored(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);

  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

/** Reads a stored value, falling back when storage is unavailable. */
export function readStored(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    // Storage can be blocked in private browsing.
    return fallback;
  }
}

/** Writes a stored value and tells the subscribers. */
export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked in private browsing; the value still applies
    // for this session.
  }
  notify(key);
}
