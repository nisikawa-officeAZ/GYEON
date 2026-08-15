// GYEON-LINE-SETUP-F2 — retired LIFF entry point.
//
// The previous version of this page accepted a raw customer uuid in the query
// string and fell back to a public environment LIFF variable. Both were unsafe:
// the identifier was a guessable direct object reference, and one environment
// LIFF ID cannot express the per-dealer LIFF configuration.
//
// The live surface is /liff/link/{liffId}?t={opaque token}. This page keeps the
// old URL from silently doing anything: it performs no LIFF init, no network
// call, and reads no query parameter.

export const dynamic = "force-static";

export default function RetiredLiffLinkPage() {
  return (
    <div className="min-h-screen bg-[#06C755] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl text-red-500">✕</span>
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">連携リンクが無効です</h1>
        <p className="text-sm text-gray-600">
          お手数ですが、店舗から新しいLINE連携リンクをお受け取りください。
        </p>
      </div>
    </div>
  );
}
