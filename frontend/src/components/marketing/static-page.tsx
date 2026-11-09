import * as React from "react";
import Link from "next/link";
import { PageHero } from "@/components/marketing/page-hero";
import { PublicLayout } from "@/components/marketing/public-layout";

export interface StaticSection {
  heading: string;
  body: string;
}

/**
 * Shared layout for the simple informational pages (About, Contact, Privacy,
 * Terms). Keeps these pages consistent without pulling in a full CMS.
 */
export function StaticPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: StaticSection[];
}) {
  return (
    <PublicLayout>
      <PageHero title={title} lead={intro} />

      <section className="border-b border-line">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="flex flex-col gap-8">
            {sections.map((section) => (
              <div key={section.heading} className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  {section.heading}
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                  {section.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl bg-elevated px-5 py-5">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              This page describes the ZevaPay service as it operates today.
              It is a summary for your convenience and does not replace a
              formal legal agreement.
            </p>
          </div>

          <div className="mt-8">
            <Link
              href="/"
              className="text-[13px] font-medium text-brand-link underline underline-offset-2 hover:text-brand-link-hover"
            >
              Back to home
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
