import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * A list of questions and answers.
 *
 * Built on native `<details>` elements so it works without JavaScript, is
 * keyboard accessible for free, and can be opened by a screen reader without
 * any extra ARIA wiring.
 */
export function Faq({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn("divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface", className)}>
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium text-ink transition-colors hover:bg-elevated">
            <span className="min-w-0">{item.question}</span>
            <ChevronDown
              className="size-4 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="px-5 pb-5 text-[14px] leading-relaxed text-ink-muted">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
