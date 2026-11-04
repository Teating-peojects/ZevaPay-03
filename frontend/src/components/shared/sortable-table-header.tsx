"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SortState {
  /** The field the rows are sorted by. */
  sort: string;
  /** `asc` or `desc`. */
  order: "asc" | "desc";
}

/**
 * A table header cell that toggles sorting.
 *
 * The button carries `aria-sort` so assistive technology announces the
 * current sort direction, and the icon shows which way the column is
 * sorted.
 */
export function SortableTableHead({
  field,
  label,
  state,
  onSort,
  align = "left",
  className,
}: {
  /** The field this column sorts by. */
  field: string;
  label: string;
  state: SortState;
  onSort: (field: string) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = state.sort === field;
  const Icon = active
    ? state.order === "asc"
      ? ArrowUp
      : ArrowDown
    : ChevronsUpDown;

  return (
    <th
      scope="col"
      aria-sort={
        active ? (state.order === "asc" ? "ascending" : "descending") : "none"
      }
      className={cn(
        "px-4 py-3 text-left align-middle",
        align === "right" && "text-right",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded text-[11px] font-semibold tracking-wide uppercase transition-colors",
          active ? "text-ink" : "text-ink-muted hover:text-ink",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      </button>
    </th>
  );
}
