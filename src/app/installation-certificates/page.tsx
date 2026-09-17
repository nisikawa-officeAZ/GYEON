import Link from "next/link";

import MainLayout from "@/components/layout/MainLayout";
import FeatureGate from "@/components/plans/FeatureGate";
import { getInstallationCertificates } from "@/lib/certificates/get-installation-certificates";

export const metadata = { title: "施工証明書管理 | GYEON Detailer Agent" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ customer?: string; vehicle?: string; page?: string }>;
}

function certificateUrl(issuanceId: string, download = false): string {
  const query = new URLSearchParams({ issuanceId });
  if (download) query.set("download", "1");
  return `/pdf/installation-certificate?${query.toString()}`;
}

function pageUrl(customer: string, vehicle: string, page: number): string {
  const query = new URLSearchParams();
  if (customer !== "") query.set("customer", customer);
  if (vehicle !== "") query.set("vehicle", vehicle);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix === "" ? "/installation-certificates" : `/installation-certificates?${suffix}`;
}

export default async function InstallationCertificatesPage({ searchParams }: Props) {
  const params = await searchParams;
  const result = await getInstallationCertificates(params);
  const { filters } = result;

  return (
    <MainLayout>
      <FeatureGate feature="completion_reports">
        <section className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#5f9cff]/70">
                GYEON® Detailer Agent
              </p>
              <h1 className="mt-1 text-[22px] font-bold text-[#edf3fc] md:text-[28px]">施工証明書管理</h1>
              <p className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-[#7788a4]">
                INSTALLATION CERTIFICATES
              </p>
            </div>
            <Link
              href="/completion-reports"
              className="rounded-xl border border-emerald-500/60 bg-emerald-900/20 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-900/40"
            >
              完了報告から証明書を発行
            </Link>
          </header>

          <form
            action="/installation-certificates"
            method="get"
            className="grid gap-3 rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"
          >
            <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-[#95a4bc]">
              顧客名で検索
              <input
                type="search"
                name="customer"
                defaultValue={filters.customer}
                maxLength={100}
                placeholder="氏名・会社名"
                className="min-h-[44px] min-w-0 rounded-xl border border-[#31435e] bg-[#0b1322] px-3 text-sm text-[#edf3fc] placeholder:text-[#60708a] focus:border-[#3478ff] focus:outline-none"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-[#95a4bc]">
              車両名で検索
              <input
                type="search"
                name="vehicle"
                defaultValue={filters.vehicle}
                maxLength={100}
                placeholder="メーカー・車名"
                className="min-h-[44px] min-w-0 rounded-xl border border-[#31435e] bg-[#0b1322] px-3 text-sm text-[#edf3fc] placeholder:text-[#60708a] focus:border-[#3478ff] focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="min-h-[44px] whitespace-nowrap rounded-xl bg-[#1d4ed8] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1e40af]"
            >
              検索
            </button>
            <Link
              href="/installation-certificates"
              className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-[#31435e] px-4 text-sm text-[#c3cee2] transition-colors hover:bg-[#1a2740] hover:text-white"
            >
              条件をクリア
            </Link>
          </form>

          {result.kind === "unauthenticated" ? (
            <div className="rounded-2xl border border-amber-700/60 bg-amber-900/20 p-6 text-sm text-amber-200">
              施工証明書を管理するにはログインしてください。
            </div>
          ) : result.kind === "unavailable" ? (
            <div className="rounded-2xl border border-red-700/60 bg-red-900/20 p-6 text-sm text-red-200">
              施工証明書を取得できませんでした。時間をおいて再度お試しください。
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 text-xs text-[#8191ad]">
                <p>{result.total}件の施工証明書</p>
                <p>{filters.page} / {result.pageCount}ページ</p>
              </div>

              {result.items.length === 0 ? (
                <div className="rounded-2xl border border-[#263955] bg-[#111826]/90 p-8 text-center">
                  <p className="text-sm font-semibold text-[#edf3fc]">該当する施工証明書がありません</p>
                  <p className="mt-2 text-xs leading-6 text-[#8191ad]">
                    発行前の場合は「完了報告から証明書を発行」へ進んでください。
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {result.items.map((item) => (
                    <article
                      key={item.issuanceId}
                      className="grid gap-4 rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-[#edf3fc]">{item.customerName}</h2>
                          <span className="rounded-md bg-[#17243a] px-2 py-0.5 text-[10px] text-[#91b9ff]">
                            {item.certificateNumber}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-[#c3cee2]">
                          {item.vehicleName}{item.plate ? ` · ${item.plate}` : ""}
                        </p>
                      </div>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        <dt className="text-[#7788a4]">施工日</dt><dd className="text-[#c3cee2]">{item.appliedDate}</dd>
                        <dt className="text-[#7788a4]">発行日</dt><dd className="text-[#c3cee2]">{item.issueDate}</dd>
                        <dt className="text-[#7788a4]">担当者</dt><dd className="truncate text-[#c3cee2]">{item.technician}</dd>
                      </dl>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {item.snapshotValid && item.hasDocument ? (
                          <>
                            <a
                              href={certificateUrl(item.issuanceId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-[#3478ff] bg-[#1d4ed8] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1e40af]"
                            >
                              確認
                            </a>
                            <a
                              href={certificateUrl(item.issuanceId, true)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-emerald-500/70 bg-emerald-800/50 px-3 py-2 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-700/60"
                            >
                              再発行（PDF）
                            </a>
                          </>
                        ) : (
                          <span className="rounded-lg border border-amber-700/60 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
                            PDF確認が必要
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {result.pageCount > 1 && (
                <nav aria-label="施工証明書のページ" className="flex items-center justify-center gap-3">
                  {filters.page > 1 && (
                    <Link
                      href={pageUrl(filters.customer, filters.vehicle, filters.page - 1)}
                      className="rounded-lg border border-[#31435e] px-4 py-2 text-sm text-[#c3cee2] hover:bg-[#1a2740]"
                    >
                      前へ
                    </Link>
                  )}
                  {filters.page < result.pageCount && (
                    <Link
                      href={pageUrl(filters.customer, filters.vehicle, filters.page + 1)}
                      className="rounded-lg border border-[#31435e] px-4 py-2 text-sm text-[#c3cee2] hover:bg-[#1a2740]"
                    >
                      次へ
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </section>
      </FeatureGate>
    </MainLayout>
  );
}
