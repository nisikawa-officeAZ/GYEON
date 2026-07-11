// EstimateNotes — reuses the shared NotesBlock (left brand-primary bar + numbered list). No duplication.

import { NotesBlock } from "../../components";

export function EstimateNotes({ notes, accent }: { notes: string[]; accent: string }) {
  return <NotesBlock title="ご案内事項 ・ Notes" notes={notes} accent={accent} ordered />;
}
