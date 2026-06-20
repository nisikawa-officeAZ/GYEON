import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-lg p-4 ${className}`}>
      {children}
    </div>
  );
}
