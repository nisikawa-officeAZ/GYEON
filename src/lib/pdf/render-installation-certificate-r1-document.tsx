import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

import { InstallationCertificateR1Document } from "@/components/documents/templates/certificates/InstallationCertificateR1Document";
import {
  toInstallationCertificateR1Presentation,
  type InstallationCertificateSnapshot,
} from "@/lib/certificates/installation-certificate-r1-artifact-core";
import { registerPdfFonts } from "./register-fonts";

/** Byte-only, offline renderer. Persistence and Storage authority live in the ensure action. */
export async function renderInstallationCertificateR1DocumentPdf(
  snapshot: InstallationCertificateSnapshot,
  logoDataUri: string | null,
): Promise<Buffer> {
  if (logoDataUri !== null && !logoDataUri.startsWith("data:image/")) {
    throw new TypeError("installation-certificate: offline logo bytes required");
  }
  registerPdfFonts();
  const data = toInstallationCertificateR1Presentation(snapshot);
  return renderToBuffer(<InstallationCertificateR1Document data={data} logoDataUri={logoDataUri} />);
}
