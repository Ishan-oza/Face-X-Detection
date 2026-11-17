import type { ReactNode } from 'react';
import { TEAM } from '../data/project';
import { PageLink } from '../lib/navigation';
import { Reveal } from './Reveal';
import { PageHeader } from './ui';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** Shared layout for the Privacy Policy and Terms of Service. */
export function LegalLayout({
  label,
  title,
  intro,
  updated,
  sections,
}: {
  label: string;
  title: ReactNode;
  intro: ReactNode;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <PageHeader compact index="—" label={label} title={title}>
        {intro}
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-mist">Last updated {updated}</p>
      </PageHeader>

      <div className="shell grid gap-10 py-12 sm:py-16 lg:grid-cols-12 lg:gap-14">
        <nav aria-label="Contents" className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-28">
            <p className="eyebrow">Contents</p>
            <ol className="mt-4 space-y-1 border-l hairline">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <PageLink
                    to={{ hash: s.id }}
                    replace
                    className="-ml-px block border-l border-transparent py-1.5 pl-4 text-sm text-mist transition-colors hover:border-signal hover:text-bone"
                  >
                    <span className="mr-2 font-mono text-[11px] text-ink-500">{String(i + 1).padStart(2, '0')}</span>
                    {s.title}
                  </PageLink>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="max-w-3xl lg:col-span-9">
          {sections.map((s, i) => (
            <Reveal as="section" key={s.id} id={s.id} className="scroll-mt-24 md:scroll-mt-28 border-b hairline py-8 first:pt-0 last:border-0">
              <h2 className="display text-3xl sm:text-4xl">
                <span className="mr-3 align-middle font-mono text-sm text-signal">{String(i + 1).padStart(2, '0')}</span>
                {s.title}
              </h2>
              <div className="legal-prose mt-4">{s.body}</div>
            </Reveal>
          ))}
        </article>
      </div>
    </>
  );
}

/** The team's addresses as mailto links, for the contact sections. */
export function TeamContacts() {
  return (
    <ul>
      {TEAM.map((m) => (
        <li key={m.email}>
          {m.name}: <a href={`mailto:${m.email}`}>{m.email}</a>
        </li>
      ))}
    </ul>
  );
}
