// Pure vehicle-registration archive path validation.
//
// Storage object names are security-sensitive identifiers, not filesystem paths.
// Only paths created by buildVehicleRegStoragePath() are accepted here: literal
// slash-separated canonical segments with no escaping or pre-archived prefix.

export type VehicleRegistrationArchivePathResult =
  | { success: true; archivedPath: string }
  | { success: false };

function isCanonicalSegment(segment: string): boolean {
  return (
    segment.length > 0 &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("\\") &&
    !segment.includes("%")
  );
}

export function buildVehicleRegistrationArchivePath(
  dealerId: string,
  storagePath: string,
): VehicleRegistrationArchivePathResult {
  if (!isCanonicalSegment(dealerId) || dealerId.includes("/")) {
    return { success: false };
  }

  if (storagePath.includes("\\") || storagePath.includes("%")) {
    return { success: false };
  }

  const segments = storagePath.split("/");
  if (segments.length < 2 || segments.some((segment) => !isCanonicalSegment(segment))) {
    return { success: false };
  }

  if (segments[0] !== dealerId || segments[1] === "archived") {
    return { success: false };
  }

  return {
    success: true,
    archivedPath: `${dealerId}/archived/${segments.slice(1).join("/")}`,
  };
}
