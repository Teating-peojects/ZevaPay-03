import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  // Build a compact page list: first, last, current ±1, with ellipses.
  const pages: (number | "gap")[] = [];
  const window = 1;

  for (let index = 1; index <= pageCount; index += 1) {
    const isEdge = index === 1 || index === pageCount;
    const isNear = Math.abs(index - page) <= window;
    if (isEdge || isNear) {
      pages.push(index);
    } else if (pages[pages.length - 1] !== "gap") {
      pages.push("gap");
    }
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-t border-line px-4 py-3",
        className,
      )}
    >
      <p className="shrink-0 whitespace-nowrap text-[13px] text-ink-muted">
        Page <span className="font-medium text-ink-soft">{page}</span> of{" "}
        <span className="font-medium text-ink-soft">{pageCount}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        {pages.map((entry, index) =>
          entry === "gap" ? (
            <span
              key={`gap-${index}`}
              className="px-1 text-[13px] text-ink-faint"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? "page" : undefined}
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-lg text-[13px] font-medium transition-colors",
                entry === page
                  ? "bg-brand-solid text-white"
                  : "text-ink-soft hover:bg-elevated",
              )}
            >
              {entry}
            </button>
          ),
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
