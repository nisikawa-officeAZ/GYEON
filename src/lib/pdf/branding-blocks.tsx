// DealerOS — Shared PDF branding blocks (used by every PDF generator).
//
// Render fragments (no outer container) so each template keeps its own header/
// footer layout while sharing ONE branding presentation. Every value falls back
// gracefully to the product default when branding is missing.

import { Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { DealerBranding } from "./dealer-branding-types";

const styles = StyleSheet.create({
  logo:   { maxWidth: 120, maxHeight: 40, marginBottom: 4, objectFit: "contain" },
  name:   { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  info:   { fontSize: 8, color: "#64748b", marginTop: 1 },
  footerText: { fontSize: 8, color: "#94a3b8", textAlign: "center" },
  qrRow:    { flexDirection: "row", justifyContent: "center", marginBottom: 3 },
  qrBlock:  { alignItems: "center", marginHorizontal: 8 },
  qrImg:    { width: 44, height: 44, objectFit: "contain" },
  qrLabel:  { fontSize: 6, color: "#94a3b8", marginTop: 1 },
});

const DEFAULT_NAME = "GYEON Detailer Agent";

/** Header identity: logo + name + address/registration (fallbacks to the product name). */
export function BrandingIdentity({ branding }: { branding?: DealerBranding | null }) {
  const name = branding?.name ?? DEFAULT_NAME;
  const addrParts = [branding?.postalCode ? `〒${branding.postalCode}` : null, branding?.address].filter(Boolean);
  const addr = addrParts.join(" ");
  const info = branding?.name ? addr : "DealerOS — Dealer Management System";
  return (
    <>
      {branding?.logo?.src ? <Image src={branding.logo.src} style={styles.logo} /> : null}
      <Text style={styles.name}>{name}</Text>
      {info ? <Text style={styles.info}>{info}</Text> : null}
      {branding?.phone ? <Text style={styles.info}>TEL: {branding.phone}</Text> : null}
      {branding?.invoiceRegNo ? <Text style={styles.info}>登録番号: {branding.invoiceRegNo}</Text> : null}
    </>
  );
}

/** Footer lines: store name・phone / address・website / business hours, custom
 *  footer message, and doc number. (QR / LINE-QR are reserved on the branding
 *  object for future rendering — intentionally not drawn yet.) */
export function BrandingFooterLines({ branding, docNo }: { branding?: DealerBranding | null; docNo?: string }) {
  const line1 = [branding?.name, branding?.phone].filter(Boolean).join(" ・ ") || `${DEFAULT_NAME} — DealerOS`;
  const line2 = [branding?.address, branding?.website].filter(Boolean).join(" ・ ");
  const websiteQr = branding?.qrCode?.src ?? null;
  const lineQr = branding?.lineQr?.src ?? null;
  return (
    <>
      {(websiteQr || lineQr) && (
        <View style={styles.qrRow}>
          {websiteQr ? (
            <View style={styles.qrBlock}>
              <Image src={websiteQr} style={styles.qrImg} />
              <Text style={styles.qrLabel}>Website QR</Text>
            </View>
          ) : null}
          {lineQr ? (
            <View style={styles.qrBlock}>
              <Image src={lineQr} style={styles.qrImg} />
              <Text style={styles.qrLabel}>LINE QR</Text>
            </View>
          ) : null}
        </View>
      )}
      {branding?.footer ? <Text style={styles.footerText}>{branding.footer}</Text> : null}
      <Text style={styles.footerText}>{line1}</Text>
      {line2 ? <Text style={styles.footerText}>{line2}</Text> : null}
      {branding?.businessHours ? <Text style={styles.footerText}>{branding.businessHours}</Text> : null}
      {docNo ? <Text style={styles.footerText}>{docNo}</Text> : null}
    </>
  );
}
