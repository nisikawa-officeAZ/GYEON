// react-pdf's layout engine reads `hyphenationPenalty` off a Text node's props when it builds the
// Knuth–Plass line-break nodes, but the package's published types omit the prop. Widen it once here
// so every document Text can set it.
//
// Why documents need it: react-pdf splits a Japanese run at kanji/kana script boundaries and treats
// each boundary as an implicit hyphenation point, stamping a literal "-" into the sentence when it
// breaks there. register-fonts.ts injects zero-width break opportunities between characters; a high
// penalty is what makes the engine prefer those clean breaks over the hyphenated ones.

import { Text as ReactPdfText } from "@react-pdf/renderer";
import type { ComponentProps, ComponentType } from "react";

export const Text = ReactPdfText as unknown as ComponentType<
  ComponentProps<typeof ReactPdfText> & { hyphenationPenalty?: number }
>;
