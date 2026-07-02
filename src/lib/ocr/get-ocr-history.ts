"use server";

// DealerOS — OCR history service (Phase E9.2, reusable, NO UI). Dealer-scoped
// read over the existing vehicle_registration_files, returning the fields a
// future OCR History screen will need. dealer_id from getCurrentDealer().

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";

export interface OcrHistoryEntry {
  id:             string;
  ocrDate:        string | null;   // created_at
  operator:       string | null;   // uploaded_by (user id; name resolution is a UI concern)
  sourceFile:     string | null;   // original file name
  status:         string | null;   // ocr_status
  confidence:     number | null;   // ocr_confidence
  linkedCustomer: string | null;
  linkedVehicle:  string | null;
}

interface Ref { last_name?: string | null; first_name?: string | null; maker?: string | null; model?: string | null; plate_number?: string | null }
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export async function getOcrHistory(): Promise<OcrHistoryEntry[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicle_registration_files")
    .select(
      "id, created_at, uploaded_by, file_name, ocr_status, ocr_confidence, customers ( last_name, first_name ), vehicles ( maker, model, plate_number )",
    )
    .eq("dealer_id", dealer.dealer_id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const c = one<Ref>(row.customers as Ref | Ref[] | null);
    const v = one<Ref>(row.vehicles as Ref | Ref[] | null);
    return {
      id:             String(row.id),
      ocrDate:        (row.created_at as string) ?? null,
      operator:       (row.uploaded_by as string) ?? null,
      sourceFile:     (row.file_name as string) ?? null,
      status:         (row.ocr_status as string) ?? null,
      confidence:     typeof row.ocr_confidence === "number" ? (row.ocr_confidence as number) : null,
      linkedCustomer: c ? [c.last_name, c.first_name].filter(Boolean).join(" ") || null : null,
      linkedVehicle:  v ? [v.maker, v.model, v.plate_number].filter(Boolean).join(" ") || null : null,
    };
  });
}
