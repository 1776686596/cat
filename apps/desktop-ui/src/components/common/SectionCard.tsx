import type { PropsWithChildren } from "react";

interface SectionCardProps extends PropsWithChildren {
  eyebrow: string;
  title: string;
  summary: string;
  badge?: string;
  badgeTone?: "normal" | "warn";
}

export default function SectionCard({
  eyebrow,
  title,
  summary,
  badge,
  badgeTone = "normal",
  children,
}: SectionCardProps) {
  return (
    <section className="section-card">
      <header className="section-header">
        <div>
          <p className="page-eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
          <p className="section-summary">{summary}</p>
        </div>
        {badge ? (
          <span
            className={`status-pill ${badgeTone === "warn" ? "is-warn" : ""}`.trim()}
          >
            {badge}
          </span>
        ) : null}
      </header>
      {children}
    </section>
  );
}
