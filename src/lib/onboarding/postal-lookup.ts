"use server";

// Japanese postal-code → address lookup for onboarding Step 1.
// Server-side so there is no client CORS dependency and the feature can be
// disabled per market. Other countries: set DEALEROS_MARKET to a non-JP value
// (or NEXT_PUBLIC_DEALEROS_MARKET on the client) to disable the postal workflow.

export interface PostalLookupResult {
  success:     boolean;
  prefecture?: string;
  city?:       string;
  town?:       string;
  error?:      "disabled" | "invalid" | "not_found" | "lookup_failed";
}

export async function lookupPostalCode(rawCode: string): Promise<PostalLookupResult> {
  const market = (
    process.env.DEALEROS_MARKET ??
    process.env.NEXT_PUBLIC_DEALEROS_MARKET ??
    "JP"
  ).toUpperCase();
  if (market !== "JP") return { success: false, error: "disabled" };

  const code = (rawCode || "").replace(/[^0-9]/g, "");
  if (code.length !== 7) return { success: false, error: "invalid" };

  try {
    const res = await fetch(
      `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${code}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { success: false, error: "lookup_failed" };

    const json = await res.json();
    const r = json?.results?.[0];
    if (!r) return { success: false, error: "not_found" };

    // zipcloud: address1=都道府県, address2=市区町村, address3=町域
    return {
      success:    true,
      prefecture: r.address1 ?? "",
      city:       r.address2 ?? "",
      town:       r.address3 ?? "",
    };
  } catch {
    return { success: false, error: "lookup_failed" };
  }
}
