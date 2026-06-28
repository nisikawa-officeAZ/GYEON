// Shared react-pdf stamp renderer.
//
// Renders the dealer's seal at the STANDARDIZED physical size:
//   - square (会社印): 20mm × 20mm
//   - round  (個人印): 18mm diameter
//
// The image is never stretched: the source PNG is already a centered square at
// the correct size, and width === height === the standard size (with objectFit
// "contain" as a belt-and-braces guard), so the aspect ratio is preserved.

import React from "react";
import { View, Image, StyleSheet } from "@react-pdf/renderer";
import { mmToPt, stampSpec, type PdfStamp } from "@/lib/stamp/stamp-types";

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});

export function StampImage({ stamp }: { stamp: PdfStamp }) {
  const size = mmToPt(stampSpec(stamp.kind).mm);
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image src={stamp.src} style={{ width: size, height: size, objectFit: "contain" }} />;
}

/** Stamp with a small 「印」 caption — used in document issuer/seal areas. */
export function StampBlock({ stamp }: { stamp: PdfStamp }) {
  return (
    <View style={styles.wrap}>
      <StampImage stamp={stamp} />
    </View>
  );
}
