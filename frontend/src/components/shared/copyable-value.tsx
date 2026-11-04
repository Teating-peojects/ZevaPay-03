"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

/**
 * A read-only value with a copy button.
 *
 * Used wherever a page hands the reader something they are meant to put
 * somewhere else — a payment link, a pairing code, an API key. The toast
 * confirms the copy rather than relying on the icon change alone, because the
 * icon reverts after two seconds and a screen reader user never sees it.
 */
export function CopyableValue({
  value,
  label,
  className,
  mono = true,
  onCopied,
}: {
  /** The text placed on the clipboard. */
  value: string;
  /** What the value is, used in the toast. */
  label: string;
  className?: string;
  /** Renders the value in a monospace face. Off for plain prose. */
  mono?: boolean;
  /** Called after a successful copy. */
  onCopied?: () => void;
}) {
  const { toast } = useToast();
  const { copied, copy } = useCopyToClipboard();

  async function handleCopy() {
    const ok = await copy(value);
    toast({
      title: ok ? "Copied to clipboard" : "Could not copy",
      description: ok
        ? `${label} is on your clipboard.`
        : "Your browser blocked clipboard access. Select the text and copy it manually.",
      tone: ok ? "success" : "error",
    });
    if (ok) onCopied?.();
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-line bg-elevated px-3 py-2",
        className,
      )}
    >
      <code
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] text-ink",
          mono && "font-mono",
        )}
      >
        {value}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void handleCopy()}
        className="shrink-0"
      >
        {copied ? (
          <Check className="size-3.5 text-success-fg" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
