import { ReactNode } from "react";

interface SectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export default function Section({ title, children, className = "" }: SectionProps) {
  return (
    <section className={`mb-6 ${className}`}>
      {title && (
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
