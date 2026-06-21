"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { DocumentFileDB, DocumentType } from "./document-file-types";

/** Returns all document_files for a given document, most recent first */
export async function getDocumentFiles(
  documentType: DocumentType,
  documentId: string
): Promise<DocumentFileDB[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("document_files")
    .select("*")
    .eq("document_type", documentType)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as DocumentFileDB[];
}

/** Returns the active file for a document (latest active status) */
export async function getActiveDocumentFile(
  documentType: DocumentType,
  documentId: string
): Promise<DocumentFileDB | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("document_files")
    .select("*")
    .eq("document_type", documentType)
    .eq("document_id", documentId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as DocumentFileDB;
}
