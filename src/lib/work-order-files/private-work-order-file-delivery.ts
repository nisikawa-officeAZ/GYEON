import type {
  WorkOrderFileDB,
  WorkOrderFileView,
} from "./work-order-file-types";

// Signed URLs are bearer credentials. Keep the lifetime short enough to limit
// exposure while allowing an image, PDF, or short video to start loading.
export const WORK_ORDER_FILE_SIGNED_URL_TTL_SECONDS = 300;

export function toPrivateWorkOrderFileView(
  file: WorkOrderFileDB,
  deliveryUrl: string,
): WorkOrderFileView {
  if (!deliveryUrl) {
    throw new Error("A private delivery URL is required.");
  }

  const {
    file_path: _filePath,
    file_url: _legacyPublicUrl,
    is_public: _legacyVisibility,
    ...safeFields
  } = file;

  return {
    ...safeFields,
    delivery_url: deliveryUrl,
  };
}
