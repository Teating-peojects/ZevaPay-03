"use client";

import * as React from "react";

/**
 * Copies text to the clipboard with a short-lived "copied" flag.
 * Falls back to a hidden textarea when the Clipboard API is unavailable.
 */
export function useCopyToClipboard(resetAfter = 2000) {
  const [copied, setCopied] = React.useState(false);
  const timeout = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeout.current) window.clearTimeout(timeout.current);
    };
  }, []);

  const copy = React.useCallback(
    async (text: string): Promise<boolean> => {
      const markCopied = () => {
        setCopied(true);
        if (timeout.current) window.clearTimeout(timeout.current);
        timeout.current = window.setTimeout(() => setCopied(false), resetAfter);
      };

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          markCopied();
          return true;
        }
      } catch {
        // Fall through to the legacy path below.
      }

      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (ok) {
          markCopied();
          return true;
        }
      } catch {
        // Clipboard access denied — nothing more we can do.
      }

      return false;
    },
    [resetAfter],
  );

  return { copied, copy };
}
