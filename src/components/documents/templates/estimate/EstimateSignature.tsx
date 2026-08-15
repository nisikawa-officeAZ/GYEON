// EstimateSignature — reuses the shared SignatureBlock. concept-b Estimate omits a signature, so this
// is opt-in (rendered by the template only when data.showSignature is true).

import { SignatureBlock } from "../../components";

export function EstimateSignature() {
  return <SignatureBlock label="お客様サイン ・ Signature" width={220} />;
}
