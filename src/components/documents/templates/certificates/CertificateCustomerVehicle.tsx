// CertificateCustomerVehicle — concept-b `.vehicle-card`: a boxed 4-column × 2-row grid.
//   Row 1: Owner (serif) · Vehicle · Year · Color
//   Row 2: VIN (numeric face) · Reg. No · Application date · Detailer
// First column is wider (1.6fr) so the owner's name has room. Cells are 42px tall with their
// content vertically centred, divided by hairlines; the last row drops its bottom rule.

import { View } from "@react-pdf/renderer";
import { Text } from "../../primitives/pdf-text";
import { COLOR, BW, FONT, LH, HYPHEN_PENALTY } from "../../tokens";
import { formatDocDate } from "../../brand";
import type { CertificateDocumentData } from "./certificate-data";
import { scaled, type CertificateScale } from "./certificate-scale";

const CELL_MIN_H = 27; // 42px, tightened to fit A4
const LBL_SIZE = 5.625; // 7.5px
const LBL_TRACK = 1.125; // 0.2em

type CellVariant = "default" | "serif" | "num";

interface Cell {
  label: string;
  value: string;
  variant?: CellVariant;
  /** 1.6fr for the owner/VIN column, 1fr for the rest. */
  flex?: number;
}

function VehicleCell({
  cell,
  lastCol,
  lastRow,
  scale,
}: {
  cell: Cell;
  lastCol: boolean;
  lastRow: boolean;
  scale: CertificateScale;
}) {
  const u = scaled(scale);
  const valueStyle =
    cell.variant === "serif"
      ? { fontFamily: FONT.serif, fontSize: u(11.25), fontWeight: 700 as const }
      : cell.variant === "num"
        ? { fontFamily: FONT.num, fontSize: u(8.625), letterSpacing: u(0.18) }
        : { fontFamily: FONT.sans, fontSize: u(9) };
  return (
    <View
      style={{
        flex: cell.flex ?? 1,
        minHeight: u(CELL_MIN_H),
        justifyContent: "center",
        paddingVertical: u(6), // 8px
        paddingHorizontal: u(9), // 12px
        ...(lastCol
          ? {}
          : { borderRightWidth: BW.thin, borderRightColor: COLOR.line, borderRightStyle: "solid" as const }),
        ...(lastRow
          ? {}
          : { borderBottomWidth: BW.thin, borderBottomColor: COLOR.line, borderBottomStyle: "solid" as const }),
      }}
    >
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{
          fontFamily: FONT.sans,
          fontSize: u(LBL_SIZE),
          letterSpacing: u(LBL_TRACK),
          textTransform: "uppercase",
          color: COLOR.textMuted,
          lineHeight: LH.snug,
          marginBottom: u(1.5),
        }}
      >
        {cell.label}
      </Text>
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{ ...valueStyle, color: COLOR.textStrong, lineHeight: 1.3 }}
      >
        {cell.value}
      </Text>
    </View>
  );
}

export function CertificateCustomerVehicle({
  data,
  scale = 1,
}: {
  data: CertificateDocumentData;
  scale?: CertificateScale;
}) {
  const u = scaled(scale);
  const { customer, vehicle, installation } = data;
  const owner = [customer.name, customer.honorific].filter(Boolean).join("　");

  const rows: Cell[][] = [
    [
      { label: "Owner · お客様氏名", value: owner, variant: "serif", flex: 1.6 },
      { label: "Vehicle · 車種", value: vehicle.name },
      { label: "Year · 年式", value: vehicle.year ?? "—" },
      { label: "Color · カラー", value: vehicle.color ?? "—" },
    ],
    [
      { label: "VIN · 車体番号", value: vehicle.vin ?? "—", variant: "num", flex: 1.6 },
      { label: "Reg. No · 登録番号", value: vehicle.plate ?? "—" },
      { label: "Application · 施工日", value: formatDocDate(installation.appliedDate) },
      { label: "Detailer · 主任技術者", value: installation.technician ?? "—" },
    ],
  ];

  return (
    <View
      style={{
        borderWidth: BW.thin,
        borderColor: COLOR.line,
        borderStyle: "solid",
        marginBottom: u(7.5), // 12px, tightened to fit A4
      }}
    >
      {rows.map((cells, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {cells.map((cell, c) => (
            <VehicleCell
              key={c}
              cell={cell}
              lastCol={c === cells.length - 1}
              lastRow={r === rows.length - 1}
              scale={scale}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
