// SummaryInvoiceTemplate (Layer 4) — the production Summary Invoice (合計請求書 / monthly consolidated
// business statement), composed from the shared Document Design System + summary-invoice blocks into
// the concept-b layout:
//   Page 1:  Masthead → Title → intro → Meta(period/closing/due/method) → Parties(Billed To/Issued By)
//            → Included Invoices (page 1) + page subtotal
//   Page k:  Continuation header → Included Invoices (page k) + page subtotal
//   Last:    … + Grand Total → Reconciliation(A–G + Current Amount Due + traceability)
//            → Payment(Bank + Notice + navy Current Amount Due) → Issuer footer
//   Every page: fixed serial + "Page N / M — End/Continued".
// Deterministic pagination is DATA-DRIVEN (data.pages[] carry stored page subtotals); the PDF never
// calculates. Issuer/logos/rank from BrandProfile. Rendered with @react-pdf/renderer.

import { Fragment } from "react";
import { Document } from "@react-pdf/renderer";
import { DocumentPage, TitleBlock, MetaGrid, SerialFooter, type MetaCell } from "../../components";
import { Body } from "../../primitives";
import { COLOR, FS } from "../../tokens";
import { formatDocDate, formatDocDateRange } from "../../brand";
import type { BrandProfile } from "../../types";
import type { SummaryInvoiceDocumentData } from "./summary-invoice-data";
import { SummaryInvoiceHeader, SummaryInvoiceContinuationHeader } from "./SummaryInvoiceHeader";
import { SummaryInvoiceCustomerBlock } from "./SummaryInvoiceCustomerBlock";
import { SummaryInvoiceTable } from "./SummaryInvoiceTable";
import { SummaryInvoiceReconciliation } from "./SummaryInvoiceReconciliation";
import { SummaryInvoicePaymentBlock } from "./SummaryInvoicePaymentBlock";
import { SummaryInvoiceFooter } from "./SummaryInvoiceFooter";

const DEFAULT_INTRO =
  "下記の通り、対象期間内に発行された請求書を集約し、月次のご請求額を通知いたします。個別請求書の明細は各請求書をご参照ください。「今回請求対象」列に Yes と記載された行のみが今回請求額の対象となります。";

export function SummaryInvoiceTemplate({ brand, data }: { brand: BrandProfile; data: SummaryInvoiceDocumentData }) {
  const titleJa = data.titleJa ?? "合計請求書";
  const titleEn = data.titleEn ?? "Summary Invoice / Monthly Consolidated Billing";
  const totalPages = data.pages.length;
  const accent = brand.colors.primary || COLOR.textStrong;

  const meta: MetaCell[] = [
    { label: "Billing Period · 対象期間", value: formatDocDateRange(data.billingPeriodStart, data.billingPeriodEnd) },
    { label: "Closing Date · 締め日", value: data.closingLabel },
    { label: "Payment Due · 支払期限", value: formatDocDate(data.paymentDueDate), emphasis: true },
    { label: "Payment Method · 支払方法", value: data.paymentMethod },
  ];

  // concept-b `.title-block__ja` — 0.12em of the 合計請求書 title size.
  const titleTracking = FS.fs28 * 0.12;

  return (
    <Document title={`合計請求書 ${data.serial}`} author={brand.brandNameJa || brand.brandNameEn || "DealerOS"}>
      <DocumentPage>
        {/* Page 1 header cluster */}
        <SummaryInvoiceHeader brand={brand} data={data} />
        <TitleBlock
          meta={{ type: "summary-invoice", serial: data.serial, issueDate: data.issueDate, titleJa, titleEn }}
          titleTracking={titleTracking}
        />
        <Body style={{ fontSize: FS.fs11, lineHeight: 1.55, color: COLOR.text, marginBottom: 10 }}>{data.intro ?? DEFAULT_INTRO}</Body>
        <MetaGrid cells={meta} accent={accent} />
        <SummaryInvoiceCustomerBlock brand={brand} customer={data.customer} salesPerson={data.responsibleSalesPerson} />

        {/* Invoice list page-groups — flat flow; each continuation header forces a page break, so
            react-pdf fills each page and only the true last page carries the closing block. */}
        {data.pages.map((page, i) => {
          const isLast = i === totalPages - 1;
          return (
            <Fragment key={i}>
              {i > 0 ? <SummaryInvoiceContinuationHeader data={data} /> : null}
              <SummaryInvoiceTable
                page={page}
                pageIndex={i}
                totalPages={totalPages}
                totalCount={data.totalCount}
                grandTotal={isLast ? data.grandTotal : undefined}
                accent={accent}
              />
            </Fragment>
          );
        })}

        {/* Closing block — flows immediately after the final page subtotal / grand total */}
        <SummaryInvoiceReconciliation
          lines={data.reconciliation}
          currentAmountDue={data.currentAmountDue}
          traceability={data.traceability}
          accent={accent}
        />
        <SummaryInvoicePaymentBlock
          brand={brand}
          currentAmountDue={data.currentAmountDue}
          currentAmountDueNote={data.currentAmountDueNote}
          paymentNotice={data.paymentNotice}
        />
        <SummaryInvoiceFooter brand={brand} />

        {/* concept-b `.serial` names the billed party next to the serial, so a detached sheet still
            identifies its customer. */}
        <SerialFooter serial={data.serial} label={`${data.serial} · ${data.customer.name}`} />
      </DocumentPage>
    </Document>
  );
}
