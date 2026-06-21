// DealerOS — Document File Types (PHASE54)
// Pure types file — no "use server" directive

export type DocumentType = "estimate" | "completion_report" | "invoice" | "product_order";
export type DocumentFileStatus = "active" | "archived" | "deleted";

export interface DocumentFileDB {
  id:                    string;
  dealer_id:             string;
  document_type:         DocumentType;
  document_id:           string;
  file_name:             string;
  file_path:             string;
  public_url:            string | null;
  signed_url_expires_at: string | null;
  file_size:             number | null;
  mime_type:             string;
  status:                DocumentFileStatus;
  created_at:            string;
  updated_at:            string;
}

export function documentTypeLabel(type: DocumentType): string {
  switch (type) {
    case "estimate":          return "見積書";
    case "completion_report": return "作業完了報告書";
    case "invoice":           return "請求書";
    case "product_order":     return "商品注文書";
  }
}

export function documentFileStatusLabel(status: DocumentFileStatus): string {
  switch (status) {
    case "active":   return "有効";
    case "archived": return "アーカイブ";
    case "deleted":  return "削除済み";
  }
}

export function buildDocumentFileName(
  documentType: DocumentType,
  documentNumber: string
): string {
  return `${documentNumber}.pdf`;
}

export function buildDocumentStoragePath(
  dealerId: string,
  documentType: DocumentType,
  fileName: string
): string {
  return `${dealerId}/${documentType}/${fileName}`;
}
