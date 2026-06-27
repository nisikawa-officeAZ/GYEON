"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LogoutButtonProps {
  className?: string;
  style?:     React.CSSProperties;
  children?:  React.ReactNode;
}

export default function LogoutButton({ className, style, children }: LogoutButtonProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={
        className ??
        "text-xs text-slate-500 hover:text-slate-100 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
      }
      style={style}
    >
      {children ?? "ログアウト"}
    </button>
  );
}
