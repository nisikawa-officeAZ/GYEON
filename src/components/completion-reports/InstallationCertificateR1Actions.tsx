"use client";

import { useState, useTransition } from "react";

import {
  issueInstallationCertificateR1Document,
  type IssueInstallationCertificateR1DocumentResult,
} from "@/lib/certificates/issue-installation-certificate-r1-document";
import type {
  InstallationCertificateR1NotEligibleReason,
} from "@/lib/certificates/installation-certificate-r1-issuance-contract";

interface InstallationCertificateR1ActionsProps {
  completionReportId: string;
}

interface ReadyCertificate {
  issuanceId: string;
  certificateNumber: string;
  issuedOn: string;
}

const NOT_ELIGIBLE_LABELS: Record<InstallationCertificateR1NotEligibleReason, string> = {
  "not-canonical": "正規の完了報告書ではありません。",
  "work-order-not-completed": "作業指示が完了していません。",
  "missing-report-number": "報告書番号が未採番です。",
  "missing-report-date": "報告日が未設定です。",
  "snapshot-unconfirmed": "施工内容が確定されていません。",
  "snapshot-empty": "確定済みの施工内容がありません。",
  "archived": "アーカイブ済みの報告書です。",
  "missing-customer-name": "顧客名が未設定です。",
  "missing-vehicle-name": "車両名が未設定です。",
  "missing-applied-date": "施工日が未設定です。",
  "missing-technician": "施工担当者が未設定です。",
  "invalid-snapshot-item": "施工内容に不正な項目があります。",
  "missing-issuer-name": "発行店舗名が未設定です。",
};

function failureMessage(result: Exclude<IssueInstallationCertificateR1DocumentResult, { kind: "ready" }>): string {
  switch (result.kind) {
    case "unauthenticated": return "ログイン状態を確認してください。";
    case "invalid_request": return "完了報告書の指定が正しくありません。";
    case "not_found": return "発行対象の完了報告書が見つかりません。";
    case "permission_denied": return "施工証明書を発行する権限がありません。";
    case "idempotency_conflict": return "発行処理が競合しました。画面を更新して再確認してください。";
    case "unavailable": return "施工証明書を発行できませんでした。時間をおいて再試行してください。";
    case "not_eligible": return result.reasons.map((reason) => NOT_ELIGIBLE_LABELS[reason]).join(" ");
    case "document_error": {
      switch (result.reason) {
        case "branding_error": return "店舗ロゴを確認できません。設定画面でロゴを確認してください。";
        case "render_error": return "施工証明書PDFを生成できませんでした。";
        case "storage_error": return "施工証明書PDFを保存できませんでした。";
        case "snapshot_invalid": return "発行済みデータの整合性を確認できません。";
        case "artifact_integrity_error": return "保存済みPDFの整合性を確認できません。";
        case "artifact_conflict": return "施工証明書PDFの保存が競合しました。画面を更新してください。";
        case "cleanup_failed": return "PDF保存処理を安全に終了できませんでした。サポートへ連絡してください。";
        case "permission_denied": return "施工証明書PDFを作成する権限がありません。";
        case "not_found": return "発行済み施工証明書が見つかりません。";
        case "invalid_request": return "施工証明書PDFの指定が正しくありません。";
        case "not_stored":
        case "persistence_error": return "施工証明書PDFを確定できませんでした。時間をおいて再試行してください。";
      }
    }
  }
}

function certificateUrl(issuanceId: string, download = false): string {
  const query = new URLSearchParams({ issuanceId });
  if (download) query.set("download", "1");
  return `/pdf/installation-certificate?${query.toString()}`;
}

export default function InstallationCertificateR1Actions({
  completionReportId,
}: InstallationCertificateR1ActionsProps) {
  const [pending, startTransition] = useTransition();
  const [ready, setReady] = useState<ReadyCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleIssue() {
    const confirmed = window.confirm(
      "施工証明書は確定済みの施工内容から発行され、発行後は内容を変更できません。発行しますか？",
    );
    if (!confirmed) return;

    // Open synchronously to preserve the user's click gesture. If the browser
    // blocks it, the durable link remains visible after successful issuance.
    const pdfWindow = window.open("about:blank", "_blank");
    if (pdfWindow) pdfWindow.opener = null;

    setError(null);
    startTransition(async () => {
      try {
        const result = await issueInstallationCertificateR1Document(completionReportId);
        if (result.kind !== "ready") {
          pdfWindow?.close();
          setError(failureMessage(result));
          return;
        }

        setReady(result);
        pdfWindow?.location.replace(certificateUrl(result.issuanceId));
      } catch {
        pdfWindow?.close();
        setError("施工証明書を発行できませんでした。時間をおいて再試行してください。");
      }
    });
  }

  if (ready) {
    return (
      <div className="flex flex-col items-end gap-1.5" aria-live="polite">
        <p className="text-[10px] text-emerald-300">
          発行済み {ready.certificateNumber} · {ready.issuedOn}
        </p>
        <div className="flex flex-wrap justify-end gap-1.5">
          <a
            href={certificateUrl(ready.issuanceId)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-emerald-500/70 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
          >
            施工証明書を表示
          </a>
          <a
            href={certificateUrl(ready.issuanceId, true)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[#263955] px-3 py-1.5 text-xs font-medium text-[#c3cee2] transition-colors hover:bg-[#1a2740] hover:text-white"
          >
            ダウンロード
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5" aria-live="polite">
      <button
        type="button"
        onClick={handleIssue}
        disabled={pending}
        className="rounded-lg border border-emerald-500/70 bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "施工証明書を発行中..." : "施工証明書を発行"}
      </button>
      {error && <p className="max-w-xs text-right text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
