// CompletionReportWorkSection — the three non-monetary report sections of concept-b:
//   04 Before & After  施工写真     — paired photo cards (placeholder frame when no image)
//   06 Inspection Checklist 施工前点検結果 — label + result grid, with summary
//   07 Technician's Note 技術者コメント    — quoted chief-technician comment
// All content is stored Completion data; nothing is computed.

import { View, Image } from "@react-pdf/renderer";
import { Row, Stack, Overline, Value, Caption, Body } from "../../primitives";
import { COLOR, BW, FS, TRACK, RADIUS } from "../../tokens";
import type { CompletionPhoto, InspectionItem } from "./completion-report-data";

/* ── 04 Before & After ─────────────────────────────────────────────────── */

function PhotoCell({ label, url, date, accent }: { label: string; url?: string; date?: string; accent: string }) {
  return (
    <Stack style={{ flex: 1 }} gap={0}>
      <View
        style={{
          height: 72,
          backgroundColor: COLOR.gray50,
          borderWidth: BW.hair,
          borderColor: COLOR.line,
          borderStyle: "solid",
          borderRadius: RADIUS.sm,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {url ? (
          <Image src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Caption style={{ fontSize: FS.fs9, color: COLOR.textFaint }}>No Image</Caption>
        )}
      </View>
      <Row style={{ justifyContent: "space-between", alignItems: "center", marginTop: 1 }}>
        <Caption style={{ fontSize: FS.fs9, letterSpacing: TRACK.wide, textTransform: "uppercase", color: accent }}>{label}</Caption>
        {date ? <Caption style={{ fontSize: FS.fs9, color: COLOR.textFaint }}>{date}</Caption> : null}
      </Row>
    </Stack>
  );
}

function PhotoCard({ photo, accent }: { photo: CompletionPhoto; accent: string }) {
  return (
    <Stack style={{ width: "48%" }} gap={2}>
      <Caption style={{ fontSize: FS.fs10, color: COLOR.textStrong }}>{photo.area}</Caption>
      <Row gap={4}>
        <PhotoCell label="Before" url={photo.beforeUrl} date={photo.beforeDate} accent={COLOR.textMuted} />
        <PhotoCell label="After" url={photo.afterUrl} date={photo.afterDate} accent={accent} />
      </Row>
    </Stack>
  );
}

export function CompletionReportPhotoSection({ photos, accent }: { photos: CompletionPhoto[]; accent: string }) {
  if (!photos.length) return null;
  return (
    <View style={{ marginBottom: 6 }}>
      <Row gap={6} style={{ alignItems: "center", marginBottom: 4 }}>
        <Value style={{ fontSize: FS.fs14, color: accent }}>04</Value>
        <Overline>Before &amp; After</Overline>
        <Caption style={{ fontSize: FS.fs10 }}>施工写真</Caption>
      </Row>
      <Row style={{ flexWrap: "wrap", justifyContent: "space-between", rowGap: 6 }}>
        {photos.map((p, i) => (
          <PhotoCard key={i} photo={p} accent={accent} />
        ))}
      </Row>
    </View>
  );
}

/* ── 06 Inspection Checklist ───────────────────────────────────────────── */

function ResultBadge({ result, accent }: { result: string; accent: string }) {
  const ok = /^ok$/i.test(result.trim());
  const color = ok ? COLOR.success : COLOR.warning ?? accent;
  return (
    <View style={{ alignSelf: "flex-start", borderWidth: BW.hair, borderColor: color, borderStyle: "solid", borderRadius: RADIUS.sm, paddingVertical: 0.5, paddingHorizontal: 4 }}>
      <Caption style={{ fontSize: FS.fs9, letterSpacing: TRACK.wide, textTransform: "uppercase", color }}>{result}</Caption>
    </View>
  );
}

export function CompletionReportInspection({
  items,
  summary,
  accent,
}: {
  items: InspectionItem[];
  summary?: string;
  accent: string;
}) {
  if (!items.length) return null;
  return (
    <View style={{ marginBottom: 6 }} wrap={false}>
      <Row gap={6} style={{ alignItems: "center", marginBottom: 4 }}>
        <Value style={{ fontSize: FS.fs14, color: accent }}>06</Value>
        <Overline>Inspection Checklist</Overline>
        <Caption style={{ fontSize: FS.fs10 }}>施工前点検結果</Caption>
        <View style={{ flex: 1 }} />
        {summary ? <Caption style={{ fontSize: FS.fs9 }}>{summary}</Caption> : null}
      </Row>
      <Row style={{ flexWrap: "wrap", justifyContent: "space-between", rowGap: 0 }}>
        {items.map((it, i) => (
          <Row
            key={i}
            style={{
              width: "48.5%",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 1.5,
              borderBottomWidth: BW.hair,
              borderBottomColor: COLOR.lineHair,
              borderBottomStyle: "solid",
            }}
          >
            <Caption style={{ flex: 1, fontSize: FS.fs10, color: COLOR.textStrong, paddingRight: 4 }}>{it.label}</Caption>
            <ResultBadge result={it.result} accent={accent} />
          </Row>
        ))}
      </Row>
    </View>
  );
}

/* ── 07 Technician's Note ──────────────────────────────────────────────── */

export function CompletionReportNote({ note, accent }: { note?: string; accent: string }) {
  if (!note) return null;
  return (
    <View style={{ marginBottom: 6 }} wrap={false}>
      <Row gap={6} style={{ alignItems: "center", marginBottom: 3 }}>
        <Value style={{ fontSize: FS.fs14, color: accent }}>07</Value>
        <Overline>Technician&apos;s Note</Overline>
        <Caption style={{ fontSize: FS.fs10 }}>技術者コメント</Caption>
      </Row>
      <View
        style={{
          borderLeftWidth: BW.thick,
          borderLeftColor: accent,
          borderLeftStyle: "solid",
          backgroundColor: COLOR.gray50,
          paddingVertical: 5,
          paddingHorizontal: 8,
        }}
      >
        <Body style={{ fontSize: FS.fs11, lineHeight: 1.4, color: COLOR.textStrong }}>{note}</Body>
      </View>
    </View>
  );
}
