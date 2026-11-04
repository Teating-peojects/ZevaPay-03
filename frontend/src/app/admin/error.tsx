"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-danger-tint">
          <TriangleAlert className="size-5 text-danger-fg" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">
          Something went wrong
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          We couldn&apos;t load this page. Try again, and if the problem
          persists contact support.
        </p>
        <Button onClick={reset} className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}
