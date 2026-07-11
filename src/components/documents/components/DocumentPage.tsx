// Layer 3 — A4 page shell. The physical frame every DealerOS document shares.
//
// react-pdf renders backgrounds by default, so the navy Grand Total block prints correctly (no
// printBackground flag needed). Fonts must be registered by the server generator BEFORE rendering
// (src/lib/pdf/register-fonts.ts) — this shell only references the registered family names.

import { Page } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { PAGE, COLOR, FONT, FS, LH } from "../tokens";

export function DocumentPage({ children }: { children: ReactNode }) {
  return (
    <Page
      size={PAGE.size}
      style={{
        paddingVertical: PAGE.padY,
        paddingHorizontal: PAGE.padX,
        backgroundColor: COLOR.white,
        color: COLOR.text,
        fontFamily: FONT.sans,
        fontSize: FS.fs13,
        lineHeight: LH.normal,
      }}
    >
      {children}
    </Page>
  );
}
