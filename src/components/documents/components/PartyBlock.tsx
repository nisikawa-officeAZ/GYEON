// Layer 3 — Party Block (customer / issuer) and Vehicle Block.
// Header label in brand-primary; party name large with the honorific chosen by party kind.

import { View } from "@react-pdf/renderer";
import { Stack, Row, Overline, ValueLg, Value, Caption } from "../primitives";
import { COLOR, BW } from "../tokens";
import { honorific } from "../brand";
import type { Party, VehicleInfo } from "../types";

export function PartyBlock({
  label,
  party,
  accent,
}: {
  label: string;
  party: Party;
  accent?: string;
}) {
  const primary = accent || COLOR.textStrong;
  return (
    <Stack gap={4} style={{ flex: 1 }}>
      <Overline style={{ color: primary }}>{label}</Overline>
      <Row gap={4} style={{ alignItems: "flex-end" }}>
        <ValueLg>{party.name}</ValueLg>
        <Value style={{ marginBottom: 1 }}>{honorific(party.kind)}</Value>
      </Row>
      <Stack gap={1}>
        {party.postalCode ? <Caption>〒{party.postalCode}</Caption> : null}
        {party.address ? <Caption>{party.address}</Caption> : null}
        {party.tel ? <Caption>TEL {party.tel}</Caption> : null}
        {party.contactPerson ? <Caption>ご担当：{party.contactPerson}</Caption> : null}
      </Stack>
    </Stack>
  );
}

export function VehicleBlock({ label, vehicle }: { label: string; vehicle: VehicleInfo }) {
  const rows: Array<[string, string | undefined]> = [
    ["車種", vehicle.makeModel],
    ["車台番号", vehicle.vin],
    ["ナンバー", vehicle.plate],
    ["カラー", vehicle.color],
    ["初度登録", vehicle.firstRegistration],
    ["走行距離", vehicle.mileage],
  ];
  return (
    <Stack gap={4} style={{ flex: 1 }}>
      <Overline>{label}</Overline>
      <View
        style={{
          borderLeftWidth: BW.thin,
          borderLeftColor: COLOR.line,
          borderLeftStyle: "solid",
          paddingLeft: 8,
        }}
      >
        {rows
          .filter(([, v]) => !!v)
          .map(([k, v], i) => (
            <Row key={i} gap={6} style={{ marginBottom: 1 }}>
              <Caption style={{ width: 52, color: COLOR.textMuted }}>{k}</Caption>
              <Value style={{ flex: 1 }}>{v}</Value>
            </Row>
          ))}
      </View>
    </Stack>
  );
}
