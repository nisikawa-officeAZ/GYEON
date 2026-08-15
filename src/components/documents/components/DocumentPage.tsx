// Layer 3 — A4 page shell. The physical frame every DealerOS document shares.
//
// react-pdf renders backgrounds by default, so the navy Grand Total block prints correctly (no
// printBackground flag needed). Fonts must be registered by the server generator BEFORE rendering
// (src/lib/pdf/register-fonts.ts) — this shell only references the registered family names.
//
// The Page deliberately sets NO `lineHeight`: react-pdf silently drops any Text that uses the
// `render` callback (dynamic page numbers) when `lineHeight`, `letterSpacing`, or `textTransform`
// is in its effective style — including values inherited from the Page. A Page-level line height
// therefore made every template's SerialFooter render as nothing. The body rhythm is carried by the
// Layer-2 primitives instead, which each declare their own line height, so nothing else changes.

import { Page } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { PAGE, COLOR, FONT, FS } from "../tokens";

/**
 * Page margins. Defaults to the business-document frame (16mm / 18mm). The certificates are
 * authored on a slightly different sheet — concept-b sets them to `16mm 15mm 14mm` — so they pass
 * their own; every other document leaves this alone and is unaffected.
 */
export interface PagePadding {
  top?: string;
  bottom?: string;
  horizontal?: string;
}

export function DocumentPage({ children, padding }: { children: ReactNode; padding?: PagePadding }) {
  return (
    <Page
      size={PAGE.size}
      style={{
        paddingTop: padding?.top ?? PAGE.padY,
        paddingBottom: padding?.bottom ?? PAGE.padY,
        paddingHorizontal: padding?.horizontal ?? PAGE.padX,
        backgroundColor: COLOR.white,
        color: COLOR.text,
        fontFamily: FONT.sans,
        fontSize: FS.fs13,
      }}
    >
      {children}
    </Page>
  );
}
