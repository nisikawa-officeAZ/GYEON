import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  projectInstallationCertificateR1,
  type InstallationCertificateR1Source,
} from "./installation-certificate-r1-contract";

type EstimateInputIsRepresentable = "estimateItems" extends keyof InstallationCertificateR1Source
  ? true
  : false;
const estimateInputIsRepresentable: EstimateInputIsRepresentable = false;

const validSource = (
  overrides: Partial<InstallationCertificateR1Source> = {},
): InstallationCertificateR1Source => ({
  customer: { lastName: "石井", firstName: "紗也華", isBusiness: false },
  vehicle: {
    maker: "Ferrari",
    model: "458 Italia",
    year: "2015",
    grade: "Base",
    vin: "ZFF67N",
    plate: "名古屋 300 あ 12-34",
    color: "Rosso Corsa",
  },
  appliedAt: "2026-09-15T15:30:00.000Z",
  technicianName: "西川 敦司",
  items: [
    { category: "coating", itemName: "Q² Mohs EVO", description: "ボディ施工", sortOrder: 1 },
  ],
  ...overrides,
});

describe("projectInstallationCertificateR1", () => {
  it("cannot represent estimate items in the source type", () => {
    assert.equal(estimateInputIsRepresentable, false);
  });

  it("projects the exact minimal non-warranty document shape", () => {
    const result = projectInstallationCertificateR1(validSource());
    assert.deepEqual(result, {
      ready: true,
      projection: {
        documentClass: "installation-certificate-r1",
        customer: { name: "石井 紗也華", honorific: "様" },
        vehicle: {
          name: "Ferrari 458 Italia",
          maker: "Ferrari",
          model: "458 Italia",
          year: "2015",
          grade: "Base",
          vin: "ZFF67N",
          plate: "名古屋 300 あ 12-34",
          color: "Rosso Corsa",
        },
        installation: { appliedDate: "2026-09-16", technician: "西川 敦司" },
        items: [{ category: "coating", name: "Q² Mohs EVO", description: "ボディ施工" }],
      },
    });
  });

  it("uses 御中 only for an explicit business customer", () => {
    const business = projectInstallationCertificateR1(validSource({
      customer: { lastName: "有限会社", firstName: "オフィスアズ", isBusiness: true },
    }));
    const unknown = projectInstallationCertificateR1(validSource({
      customer: { lastName: "山田", firstName: "太郎", isBusiness: null },
    }));
    assert.equal(business.ready && business.projection.customer.honorific, "御中");
    assert.equal(unknown.ready && unknown.projection.customer.honorific, "様");
  });

  it("keeps a legacy whole name stored in lastName", () => {
    const result = projectInstallationCertificateR1(validSource({
      customer: { lastName: "石井 紗也華", firstName: null, isBusiness: false },
    }));
    assert.equal(result.ready && result.projection.customer.name, "石井 紗也華");
  });

  it("requires at least one of vehicle maker or model", () => {
    const result = projectInstallationCertificateR1(validSource({
      vehicle: { maker: " ", model: null, year: null, grade: null, vin: null, plate: null, color: null },
    }));
    assert.deepEqual(result, { ready: false, reasons: ["missing-vehicle-name"] });
  });

  it("derives the calendar date in Asia/Tokyo across UTC rollover", () => {
    const result = projectInstallationCertificateR1(validSource({ appliedAt: "2026-12-31T15:00:00.000Z" }));
    assert.equal(result.ready && result.projection.installation.appliedDate, "2027-01-01");
  });

  it("requires the canonical technician and invents no placeholder", () => {
    const result = projectInstallationCertificateR1(validSource({ technicianName: "  " }));
    assert.deepEqual(result, { ready: false, reasons: ["missing-technician"] });
    assert.equal(JSON.stringify(result).includes("担当者"), false);
  });

  it("stable-sorts rows by sortOrder and omits a blank description", () => {
    const result = projectInstallationCertificateR1(validSource({
      items: [
        { category: "glass", itemName: "A", description: " ", sortOrder: 2 },
        { category: "wheel", itemName: "B", description: null, sortOrder: 1 },
        { category: "coating", itemName: "C", description: "detail", sortOrder: 2 },
      ],
    }));
    assert.deepEqual(result.ready && result.projection.items, [
      { category: "wheel", name: "B" },
      { category: "glass", name: "A" },
      { category: "coating", name: "C", description: "detail" },
    ]);
  });

  it("fails closed when any confirmed row is invalid", () => {
    const result = projectInstallationCertificateR1(validSource({
      items: [
        { category: "coating", itemName: "valid", description: null, sortOrder: 1 },
        { category: " ", itemName: "invalid", description: null, sortOrder: 2 },
      ],
    }));
    assert.deepEqual(result, { ready: false, reasons: ["invalid-snapshot-item"] });
  });

  it("keeps CanCoat and CanCoat EVO PRO as ordinary common R1 items", () => {
    const result = projectInstallationCertificateR1(validSource({
      items: [
        { category: "coating", itemName: "Q² CanCoat EVO", description: null, sortOrder: 1 },
        { category: "coating", itemName: "Q² CanCoat EVO PRO", description: null, sortOrder: 2 },
      ],
    }));
    assert.equal(result.ready, true);
    assert.deepEqual(result.ready && result.projection.items.map((item) => item.name), [
      "Q² CanCoat EVO",
      "Q² CanCoat EVO PRO",
    ]);
  });

  it("serializes no monetary, memo, warranty, grant, QR, dealer, or persistence field", () => {
    const result = projectInstallationCertificateR1(validSource());
    assert.equal(result.ready, true);
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "quantity", "unitPrice", "subtotal", "tax", "discount", "total", "cost", "margin",
      "payment", "invoice", "estimateItems", "internalMemo", "customerMessage", "serviceSummary",
      "notes", "callout", "terms", "filmWarranty", "warranty", "grant", "qr", "dealerId",
      "serial", "issueDate", "storage", "logo",
    ]) {
      assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
    }
  });

  it("returns every applicable certificate reason in the fixed order", () => {
    const result = projectInstallationCertificateR1({
      customer: { lastName: " ", firstName: null, isBusiness: false },
      vehicle: { maker: null, model: "", year: null, grade: null, vin: null, plate: null, color: null },
      appliedAt: "not-a-date",
      technicianName: null,
      items: [{ category: "", itemName: "", description: null, sortOrder: Number.NaN }],
    });
    assert.deepEqual(result, {
      ready: false,
      reasons: [
        "missing-customer-name",
        "missing-vehicle-name",
        "missing-applied-date",
        "missing-technician",
        "invalid-snapshot-item",
      ],
    });
  });
});
