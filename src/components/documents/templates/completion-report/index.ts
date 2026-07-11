// CompletionReportTemplate (Layer 4) barrel.
export { CompletionReportTemplate } from "./CompletionReportTemplate";
export { CompletionReportHeader } from "./CompletionReportHeader";
export { CompletionReportCustomerBlock, CompletionReportVehicleBlock, CompletionReportIssuerBlock } from "./CompletionReportParties";
export { CompletionReportServiceTable } from "./CompletionReportServiceTable";
export { CompletionReportSummary } from "./CompletionReportSummary";
export { CompletionReportPhotoSection, CompletionReportInspection, CompletionReportNote } from "./CompletionReportWorkSection";
export { CompletionReportSignoff } from "./CompletionReportSignoff";
export { CompletionReportFooter } from "./CompletionReportFooter";
export {
  type CompletionReportDocumentData,
  type CompletionPhoto,
  type CompletedWorkItem,
  type InspectionItem,
  type CompletionCustomer,
  type CompletionVehicle,
} from "./completion-report-data";
