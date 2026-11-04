import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col bg-surface">
      <header className="border-b border-line px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Logo href="/" />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-20 sm:px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-[13px] font-semibold text-brand-link">
            404
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
            Page not found
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/">
              <Button variant="outline" className="w-full sm:w-auto">
                Back to home
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button className="w-full sm:w-auto">Go to dashboard</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
