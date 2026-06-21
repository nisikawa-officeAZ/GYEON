"use server";

// PHASE66: Official release info utility.
// Returns static release metadata. Read-only. No DB access, no mutation.

export interface OfficialReleaseInfo {
  version:     string;
  status:      "official";
  owner:       string;
  poweredBy:   string;
  releaseDate: string;
  tagline:     string;
  taglineEn:   string;
  platform:    string;
  phases:      string;
  features:    number;
  migrations:  string;
}

export async function getOfficialReleaseInfo(): Promise<OfficialReleaseInfo> {
  return {
    version:     "1.0.0",
    status:      "official",
    owner:       "Office AZ",
    poweredBy:   "GYEON Japan",
    releaseDate: "2026",
    tagline:     "施工で終わらせない。顧客との関係を、次の来店へ。",
    taglineEn:   "Beyond the detail. Every job leads to the next visit.",
    platform:    "Next.js 15 / Supabase / Vercel / LINE",
    phases:      "PHASE35 – PHASE66",
    features:    21,
    migrations:  "30+",
  };
}
