// Japanese postal-code → address lookup.
//
// Uses the free zipcloud API (https://zipcloud.ashtech.jp), which is CORS-enabled
// and therefore safe to call directly from the browser. No API key required.
//
// Returns the prefecture / city / town for a 7-digit Japanese postal code, or
// null when the code is invalid or not found. Network/parse errors resolve to
// null so callers can fail gracefully (the user can still type the address).

export interface PostalAddress {
  prefecture: string; // 都道府県  (e.g. "東京都")
  city:       string; // 市区町村  (e.g. "渋谷区")
  town:       string; // 町域      (e.g. "神宮前")
}

interface ZipcloudResult {
  address1: string; // prefecture
  address2: string; // city
  address3: string; // town
}

interface ZipcloudResponse {
  status:  number;
  message: string | null;
  results: ZipcloudResult[] | null;
}

/** Strip everything except digits and keep the first 7 (handles "150-0001", "〒1500001", full-width). */
export function normalizePostalCode(raw: string): string {
  const halfWidth = raw.replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xfee0),
  );
  return halfWidth.replace(/[^0-9]/g, "").slice(0, 7);
}

export async function lookupPostalAddress(raw: string): Promise<PostalAddress | null> {
  const zip = normalizePostalCode(raw);
  if (zip.length !== 7) return null;

  try {
    const res = await fetch(
      `https://zipcloud.ashtech.jp/api/search?zipcode=${zip}`,
      { method: "GET" },
    );
    if (!res.ok) return null;

    const json = (await res.json()) as ZipcloudResponse;
    const hit  = json.results?.[0];
    if (!hit) return null;

    return {
      prefecture: hit.address1 ?? "",
      city:       hit.address2 ?? "",
      town:       hit.address3 ?? "",
    };
  } catch {
    return null;
  }
}
