import CategoryHub, { type CategoryHubItem } from "@/components/navigation/CategoryHub";
import MainLayout from "@/components/layout/MainLayout";

export const metadata = { title: "記録・資料 | GYEON Detailer Agent" };

const ITEMS: readonly CategoryHubItem[] = [
  { href: "/pdf", label: "PDF", labelEn: "PDF", description: "見積・請求・作業報告のPDF入口を確認。", icon: "pdf" },
  { href: "/ocr-sessions", label: "OCR履歴", labelEn: "OCR HISTORY", description: "車検証OCRの読取履歴と確認状況を管理。", icon: "ocr" },
  { href: "/downloads", label: "ダウンロード", labelEn: "DOWNLOADS", description: "業務資料と提供ファイルを確認・取得。", icon: "downloads" },
] as const;

export default function RecordsHubPage() {
  return <MainLayout><CategoryHub label="記録・資料" labelEn="RECORDS" items={ITEMS} /></MainLayout>;
}
