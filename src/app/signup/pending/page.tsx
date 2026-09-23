// Sign-up pending — shown after dealer registration is submitted.
//
// Two DISTINCT wait states share this page and must never be confused:
//   confirm=1  Email verification still required. The Auth user exists but is
//              unverified; no dealer row exists yet. The password was already
//              chosen at registration — login must wait for the email link.
//   confirm=0  Email verification complete. The pending dealer row exists
//              (approval_status = 'pending'). GYEON Japan approval is a
//              separate step; authentication succeeds but access stays blocked
//              until a Super Admin / GYEON Admin approves the dealer.

import Link from "next/link";
import Brand from "@/components/ui/Brand";

interface Props {
  searchParams: Promise<{ confirm?: string; setup_error?: string }>;
}

export const metadata = { title: "登録申請の状況 | GYEON Detailer Agent" };

export default async function SignUpPendingPage({ searchParams }: Props) {
  const params       = await searchParams;
  const needsConfirm = params.confirm === "1";
  const setupError   = params.setup_error === "1";

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* ── Brand header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-center">
          <Brand size={56} />
        </div>

        {/* ── Status card ────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl border p-6 flex flex-col gap-4"
          style={{
            background:  "var(--gs-bg-card, #16161f)",
            borderColor: "var(--gs-line, rgba(255,255,255,0.08))",
          }}
        >
          {/* Icon + title */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "var(--gs-blue-dim, rgba(79,142,247,0.15))" }}
            >
              {needsConfirm ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke="var(--gs-blue, #4f8ef7)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke="var(--gs-blue, #4f8ef7)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#f0f0f5]">
                {needsConfirm ? "メールアドレスの確認が必要です" : "メールアドレスの確認が完了しました"}
              </h1>
              <p className="text-xs text-[#9999b0] mt-1">
                {needsConfirm
                  ? "確認メールを送信しました。メール内のリンクを開くまで登録申請は完了しません。"
                  : "登録申請を受け付けました。現在、GYEON Japanの承認待ちです。"}
              </p>
            </div>
          </div>

          {setupError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-xs text-red-400 leading-relaxed">
                メールアドレスは確認できましたが、店舗情報の登録を完了できませんでした。
                ログイン後に再確認するか、GYEONサポートへお問い合わせください。
              </p>
            </div>
          )}

          {/* Status message — states are deliberately different */}
          <div
            className="rounded-xl border px-4 py-4 flex flex-col gap-2"
            style={{
              background:   "rgba(79,142,247,0.06)",
              borderColor:  "rgba(79,142,247,0.20)",
            }}
          >
            {needsConfirm ? (
              <>
                <p className="text-sm font-semibold text-[#f0f0f5] leading-snug">
                  メール確認が完了するまでログインはできません。
                </p>
                <p className="text-xs text-[#9999b0] leading-relaxed">
                  パスワードは登録時に設定済みです。新しいパスワードを設定する必要はありません。
                  メール内のリンクを開いてメールアドレスの確認を完了したあとに、ログインをお試しください。
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-[#f0f0f5] leading-snug">
                  GYEON Japanの承認後にアカウントをご利用いただけます。
                </p>
                <p className="text-xs text-[#9999b0] leading-relaxed">
                  メール確認（認証）とGYEON Japanの承認は別の手続きです。
                  承認前にログインしても、機能へのアクセスは制限されたままです。
                  審査には通常1〜3営業日かかり、承認後に登録メールアドレスへご連絡します。
                </p>
              </>
            )}
          </div>

          {/* Steps */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: "var(--gs-bg-2, #111118)" }}
          >
            {needsConfirm ? (
              <>
                <Step
                  num="1"
                  title="メール内のリンクを開く"
                  body="登録したメールアドレスに確認メールをお送りしました。メール内の「メールアドレスを確認する」を押してください。受信トレイと迷惑メールフォルダもご確認ください。"
                  highlight
                />
                <Step
                  num="2"
                  title="GYEON Japanの承認を待つ"
                  body="メール確認後、GYEON Japanが申請内容を審査します。承認後、登録メールアドレスにご連絡します。"
                />
                <Step
                  num="3"
                  title="承認後にログイン"
                  body="承認完了後、登録時に設定したメールアドレスとパスワードでログインできます。"
                />
              </>
            ) : (
              <>
                <Step
                  num="1"
                  title="メールアドレスの確認"
                  body="完了しました。"
                  done
                />
                <Step
                  num="2"
                  title="GYEON Japanの承認を待つ"
                  body="GYEON Japanが申請内容を審査しています。承認後、登録メールアドレスにご連絡します。"
                  highlight
                />
                <Step
                  num="3"
                  title="承認後にログイン"
                  body="承認完了後、登録時に設定したメールアドレスとパスワードでログインできます。"
                />
              </>
            )}
          </div>

          {/* CTA — never a primary "log in now" action while a wait state is active */}
          {needsConfirm ? (
            <p className="text-center text-xs text-[#55556a] leading-relaxed">
              メール確認が完了したら{" "}
              <Link
                href="/login"
                className="underline transition-colors"
                style={{ color: "var(--gs-blue, #4f8ef7)" }}
              >
                ログイン画面
              </Link>
              {" "}からログインできます。
            </p>
          ) : (
            <Link
              href="/login"
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-center transition-all border"
              style={{
                color:       "var(--gs-text-2, #9999b0)",
                borderColor: "var(--gs-line, rgba(255,255,255,0.08))",
                background:  "var(--gs-bg-2, #111118)",
              }}
            >
              ログイン画面へ戻る（承認後にご利用いただけます）
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Local component ──────────────────────────────────────────────────────────
function Step({
  num,
  title,
  body,
  highlight = false,
  done = false,
}: {
  num: string;
  title: string;
  body: string;
  highlight?: boolean;
  done?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
        style={{
          background: done
            ? "rgba(34,197,94,0.15)"
            : highlight
              ? "var(--gs-blue-dim, rgba(79,142,247,0.15))"
              : "rgba(255,255,255,0.06)",
          color: done
            ? "var(--gs-green, #22c55e)"
            : highlight
              ? "var(--gs-blue, #4f8ef7)"
              : "var(--gs-text-3, #55556a)",
        }}
      >
        {done ? "✓" : num}
      </div>
      <div className="flex flex-col gap-0.5 flex-1">
        <p
          className="text-xs font-semibold"
          style={{ color: highlight ? "var(--gs-text, #f0f0f5)" : "var(--gs-text-2, #9999b0)" }}
        >
          {title}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--gs-text-3, #55556a)" }}>
          {body}
        </p>
      </div>
    </div>
  );
}
