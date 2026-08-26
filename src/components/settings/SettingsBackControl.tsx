"use client";

import Link from "next/link";

interface SettingsBackControlProps {
  className?: string;
  href?: string;
  label: string;
  onClick?: () => void;
}

const classes = "ml-auto flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl border border-[#263955] bg-[#0b1220]/70 px-4 py-2 text-xs font-semibold text-[#91b9ff] transition-colors hover:border-[#3b6eb4] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d9dff]";

export default function SettingsBackControl({ className = "", href, label, onClick }: SettingsBackControlProps) {
  const controlClasses = `${classes} ${className}`.trim();
  const content = (
    <>
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </>
  );

  if (href) {
    return <Link className={controlClasses} href={href}>{content}</Link>;
  }

  return <button className={controlClasses} type="button" onClick={onClick}>{content}</button>;
}
