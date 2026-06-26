// AZ Platform — Business Application Registry: Application Registry (Sprint 11W Phase B)
//
// Canonical registry of all AZ Platform business applications.
// Each manifest declares the application's business purpose, capabilities,
// shared service dependencies, and organization scope.
//
// Applications (6):
//   Active (1):   dealer_agent
//   Planned (5):  enterprise_distribution, warehouse, accounting, crm, ai_operations
//
// Design rules:
//   - Applications are fully isolated; they do not import from each other
//   - Shared services are the only cross-application communication channel
//   - Organization scope is declared per application
//   - No persistence — static declarations only
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  BusinessApplicationCapability,
  BusinessApplicationId,
  BusinessApplicationManifest,
  BusinessApplicationType,
  SharedServiceId,
} from "./business-application-types";

// ─── Capability builder ───────────────────────────────────────────────────────

function cap(
  id:           string,
  display_name: string,
  description:  string,
  status:       BusinessApplicationCapability["status"],
): BusinessApplicationCapability {
  return { capability_id: id, display_name, description, status };
}

// ─── 1. GYEON Dealer Agent ────────────────────────────────────────────────────

const DEALER_AGENT: BusinessApplicationManifest = {
  application_id: "dealer_agent",
  display_name:   "GYEON Detailer Agent",
  description:    "Cloud-based business management platform for GYEON-certified automotive detailing shops. Handles customer and vehicle records, estimates, work orders, completion reports, LINE messaging, OCR document scanning, AI marketing content, and maintenance reminders.",
  type:           "dealer_management",
  status:         "active",
  target_users:   "GYEON-certified detailing shop owners, managers, and technicians",
  capabilities: [
    cap("da.customers",             "Customer Management",      "Create, view, and manage customer records with contact information and service history",                  "available"),
    cap("da.vehicles",              "Vehicle Management",       "Register and manage customer vehicles with make, model, year, and color",                                 "available"),
    cap("da.estimates",             "Estimate Creation",        "Multi-step estimate wizard covering coating, maintenance, carwash, and other services",                   "available"),
    cap("da.work_orders",           "Work Orders",              "Track in-progress detailing jobs from estimate to completion",                                            "available"),
    cap("da.completion_reports",    "Completion Reports",       "PDF completion reports with before/after photos and service summary",                                     "available"),
    cap("da.line_messaging",        "LINE Messaging",           "Send completion reports, maintenance reminders, and review requests via LINE",                            "available"),
    cap("da.ocr",                   "OCR Document Scanning",    "Vehicle registration card OCR for rapid data entry",                                                     "available"),
    cap("da.pdf_generation",        "PDF Generation",           "Estimate and completion report PDF rendering",                                                           "available"),
    cap("da.ai_settings",           "AI Settings",              "Per-dealer AI provider configuration, API key management, and budget controls",                          "available"),
    cap("da.dealer_settings",       "Dealer Settings",          "Business profile, working hours, and notification preferences",                                          "available"),
    cap("da.staff_management",      "Staff Management",         "Invite and manage staff members with role-based access control",                                         "available"),
    cap("da.ai_marketing",          "AI Content Generation",    "AI-generated marketing copy, review request templates, and maintenance reminder content",                "planned"),
    cap("da.maintenance_reminders", "Maintenance Reminders",    "Automated reminder scheduling for coating and maintenance cycles",                                       "planned"),
    cap("da.reputation_mgmt",       "Reputation Management",    "Google review request automation and star rating tracking",                                              "planned"),
  ],
  required_shared_services: ["authentication", "authorization", "pdf"],
  optional_shared_services: ["ai_gateway", "ai_marketplace", "ocr", "line", "media", "notification", "analytics", "organization"],
  required_org_scope:          ["dealer"],
  required_subscription_level: "starter",
  required_feature_flags:      [],
  supported_org_types: ["dealer", "branch", "division", "company", "platform"],
  supported_org_tiers: ["tier_6", "tier_4", "tier_3", "tier_2", "tier_1"],
  admin_roles:         ["platform_admin", "dealer_owner"],
  default_roles:       ["dealer_owner", "dealer_staff"],
  readonly_roles:      [],
  platform_application_ref: "dealer_agent",
  spec_document:            "01_PROJECT_OVERVIEW.md",
  implementation_sprint:    "Sprint 1",
};

// ─── 2. Enterprise Distribution Platform ──────────────────────────────────────

const ENTERPRISE_DISTRIBUTION: BusinessApplicationManifest = {
  application_id: "enterprise_distribution",
  display_name:   "Enterprise Distribution Platform",
  description:    "B2B wholesale distribution management for Office AZ Group. Digitizes the GYEON Japan supply chain from importer (Office AZ) through Attraction Co., Ltd. to wholesalers and retail stores. Replaces telephone, fax, and email order workflows.",
  type:           "b2b_distribution",
  status:         "planned",
  target_users:   "Office AZ Group staff, Attraction Co., Ltd. operations team, authorized wholesalers and retail stores",
  capabilities: [
    cap("edp.b2b_ordering",       "B2B Order Management",       "Digital order placement, confirmation, and status tracking for wholesalers and retailers",   "planned"),
    cap("edp.wholesaler_portal",  "Wholesaler Portal",          "Self-service portal for authorized wholesalers to place and track orders",                    "planned"),
    cap("edp.retailer_portal",    "Retailer Portal",            "Self-service portal for retail stores to place and track orders",                             "planned"),
    cap("edp.inventory",          "Inventory Management",       "Real-time inventory levels, product catalog, and low-stock alerts",                          "planned"),
    cap("edp.delivery_notes",     "Delivery Note Generation",   "PDF delivery notes and packing slips for outbound shipments",                                "planned"),
    cap("edp.monthly_billing",    "Monthly Billing",            "Consolidated monthly invoice generation for credit account customers",                       "planned"),
    cap("edp.credit_accounts",    "Credit Account Workflows",   "Credit account application, approval, and credit limit management",                          "planned"),
    cap("edp.product_catalog",    "Product Catalog",            "GYEON product catalog with pricing tiers for different customer types",                      "future"),
    cap("edp.ai_demand_forecast", "AI Demand Forecasting",      "AI-powered demand forecasting and inventory replenishment recommendations",                   "future"),
  ],
  required_shared_services: ["authentication", "authorization", "pdf", "notification"],
  optional_shared_services: ["ai_gateway", "ai_marketplace", "analytics", "line", "organization"],
  required_org_scope:          ["company", "division"],
  required_subscription_level: null,
  required_feature_flags:      ["enterprise_distribution_enabled"],
  supported_org_types: ["platform", "company", "division", "branch", "warehouse"],
  supported_org_tiers: ["tier_1", "tier_2", "tier_3", "tier_4", "tier_5"],
  admin_roles:         ["platform_admin", "company_admin"],
  default_roles:       ["company_admin", "division_manager", "branch_manager"],
  readonly_roles:      ["warehouse_manager"],
  platform_application_ref: "enterprise_distribution",
  spec_document:            "ENTERPRISE_DISTRIBUTION_PLATFORM_SPEC.md",
  implementation_sprint:    null,
};

// ─── 3. Warehouse Management System ───────────────────────────────────────────

const WAREHOUSE: BusinessApplicationManifest = {
  application_id: "warehouse",
  display_name:   "Warehouse Management System",
  description:    "Physical inventory and fulfillment management for Office AZ Group warehouse operations. Tracks inbound stock receipts, pick-and-pack workflows, outbound shipments, and inventory location assignments within the warehouse.",
  type:           "warehouse_management",
  status:         "planned",
  target_users:   "Warehouse staff, logistics coordinators, warehouse managers",
  capabilities: [
    cap("wms.stock_receiving",     "Stock Receiving",             "GRN-based receiving workflow for inbound GYEON shipments from Korea",                      "planned"),
    cap("wms.picking",             "Order Picking",               "Guided pick workflow for outbound B2B orders linked to EDP",                              "planned"),
    cap("wms.shipping",            "Shipping Management",         "Carrier integration, label generation, and dispatch confirmation",                        "planned"),
    cap("wms.inventory_location",  "Inventory Location",          "Bin and shelf location management within the warehouse",                                  "future"),
    cap("wms.shipment_tracking",   "Shipment Tracking",           "Outbound shipment status from dispatch to confirmed delivery",                            "future"),
    cap("wms.cycle_count",         "Cycle Count",                 "Periodic partial inventory counts to maintain accuracy without full stocktake",            "future"),
    cap("wms.ai_replenishment",    "AI Replenishment Suggestions","AI-powered low-stock alerts and reorder quantity recommendations",                         "future"),
  ],
  required_shared_services: ["authentication", "authorization", "notification"],
  optional_shared_services: ["ai_gateway", "analytics", "organization"],
  required_org_scope:          ["warehouse"],
  required_subscription_level: null,
  required_feature_flags:      ["warehouse_management_enabled"],
  supported_org_types: ["platform", "company", "division", "warehouse"],
  supported_org_tiers: ["tier_1", "tier_2", "tier_3", "tier_5"],
  admin_roles:         ["platform_admin", "company_admin"],
  default_roles:       ["warehouse_manager"],
  readonly_roles:      ["division_manager"],
  platform_application_ref: "warehouse",
  spec_document:            null,
  implementation_sprint:    null,
};

// ─── 4. Accounting System ─────────────────────────────────────────────────────

const ACCOUNTING: BusinessApplicationManifest = {
  application_id: "accounting",
  display_name:   "Accounting System",
  description:    "Financial management for Office AZ Group. Handles accounts receivable, invoice management, closing day processing, payment status tracking, and financial reporting for Attraction Co., Ltd. distribution operations.",
  type:           "financial_management",
  status:         "planned",
  target_users:   "Accounting team, finance managers, company executives",
  capabilities: [
    cap("acc.invoices",            "Invoice Management",          "Create, track, and archive outbound invoices to wholesalers and retailers",                "planned"),
    cap("acc.statements",          "Account Statements",          "Periodic account statements for credit account customers",                                 "planned"),
    cap("acc.closing",             "Closing Day Processing",      "Month-end closing workflows with AR reconciliation",                                      "planned"),
    cap("acc.payment_status",      "Payment Status Tracking",     "Track payment receipt and flag overdue accounts",                                         "planned"),
    cap("acc.accounts_receivable", "Accounts Receivable",         "Manage outstanding receivables with aging reports by customer",                           "planned"),
    cap("acc.financial_reporting", "Financial Reporting",         "Revenue, expense, and margin reports by period and product line",                         "future"),
    cap("acc.ai_anomaly",          "AI Anomaly Detection",        "AI-flagged unusual payment patterns and potential bad debt risks",                        "future"),
  ],
  required_shared_services: ["authentication", "authorization", "pdf", "notification"],
  optional_shared_services: ["analytics", "ai_gateway", "organization"],
  required_org_scope:          ["company"],
  required_subscription_level: null,
  required_feature_flags:      ["accounting_enabled"],
  supported_org_types: ["platform", "company", "division"],
  supported_org_tiers: ["tier_1", "tier_2", "tier_3"],
  admin_roles:         ["platform_admin", "company_admin"],
  default_roles:       ["company_admin", "division_manager"],
  readonly_roles:      [],
  platform_application_ref: "accounting",
  spec_document:            null,
  implementation_sprint:    null,
};

// ─── 5. Customer Relationship Management ─────────────────────────────────────

const CRM: BusinessApplicationManifest = {
  application_id: "crm",
  display_name:   "Customer Relationship Management",
  description:    "Cross-company B2B customer relationship management for Office AZ Group. Provides a unified view of wholesaler and retailer accounts, contact management, sales follow-up automation, inactivity alerts, and opportunity tracking.",
  type:           "customer_relationship",
  status:         "planned",
  target_users:   "Sales team, account managers, customer success representatives",
  capabilities: [
    cap("crm.relationship_mgmt",    "Relationship Management",     "Unified B2B customer view with contact history and account status",                       "planned"),
    cap("crm.sales_followup",       "Sales Follow-up",             "Scheduled sales follow-up tasks and reminder workflows for account managers",            "planned"),
    cap("crm.inactivity_alerts",    "Inactivity Alerts",           "Automated alerts when customer order frequency drops below configured threshold",        "planned"),
    cap("crm.opportunity_tracking", "Opportunity Tracking",        "Track potential new accounts through the sales pipeline from lead to close",             "future"),
    cap("crm.contact_management",   "Contact Management",          "Manage contacts per B2B account with role, communication preferences, and history",      "future"),
    cap("crm.ai_scoring",           "AI Lead Scoring",             "AI-powered scoring of B2B leads and reactivation probability estimates",                 "future"),
    cap("crm.line_integration",     "LINE Business Integration",   "LINE Official Account integration for B2B customer communication",                       "future"),
  ],
  required_shared_services: ["authentication", "authorization", "notification"],
  optional_shared_services: ["ai_gateway", "ai_marketplace", "analytics", "line", "media", "organization"],
  required_org_scope:          ["company", "division"],
  required_subscription_level: null,
  required_feature_flags:      ["crm_enabled"],
  supported_org_types: ["platform", "company", "division", "branch"],
  supported_org_tiers: ["tier_1", "tier_2", "tier_3", "tier_4"],
  admin_roles:         ["platform_admin", "company_admin"],
  default_roles:       ["company_admin", "division_manager", "branch_manager"],
  readonly_roles:      [],
  platform_application_ref: "crm",
  spec_document:            null,
  implementation_sprint:    null,
};

// ─── 6. AI Operations Platform ───────────────────────────────────────────────

const AI_OPERATIONS: BusinessApplicationManifest = {
  application_id: "ai_operations",
  display_name:   "AI Operations Platform",
  description:    "Platform-level AI operations management for Office AZ Group. Provides real-time monitoring of AI request execution, cross-application usage reporting, AI Marketplace administration, provider health tracking, and cost reporting across all AI features on the AZ Platform.",
  type:           "ai_operations",
  status:         "planned",
  target_users:   "Platform administrators, AI operations engineers, CTO and technical management",
  capabilities: [
    cap("aiops.execution_monitoring", "AI Execution Monitoring",      "Real-time monitoring of AI request execution across all platform applications",          "planned"),
    cap("aiops.usage_reporting",      "AI Usage Reporting",           "Per-application and per-dealer AI usage analytics, token counts, and cost summaries",    "planned"),
    cap("aiops.marketplace_admin",    "AI Marketplace Administration","Manage capability catalog, provider profiles, and recommendation rules",                 "planned"),
    cap("aiops.provider_health",      "Provider Health Dashboard",    "AI provider uptime, latency, and error rate monitoring",                                 "planned"),
    cap("aiops.cost_reporting",       "AI Cost Reporting",            "Cross-platform AI cost breakdown by provider, application, and tenant",                  "planned"),
    cap("aiops.budget_admin",         "Budget Policy Administration", "Manage platform-level AI budget policies and per-dealer budget limits",                  "future"),
    cap("aiops.model_registry",       "AI Model Registry",            "Track and manage AI model versions and capability versions across the platform",          "future"),
    cap("aiops.audit_log",            "AI Audit Log",                 "Immutable audit log of all AI operations for compliance and debugging",                  "future"),
  ],
  required_shared_services: ["authentication", "authorization", "ai_gateway", "ai_marketplace"],
  optional_shared_services: ["analytics", "notification", "organization"],
  required_org_scope:          ["platform", "company"],
  required_subscription_level: null,
  required_feature_flags:      ["ai_operations_enabled"],
  supported_org_types: ["platform", "company"],
  supported_org_tiers: ["tier_1", "tier_2"],
  admin_roles:         ["platform_admin"],
  default_roles:       ["platform_admin", "company_admin"],
  readonly_roles:      ["division_manager"],
  platform_application_ref: "ai_operations",
  spec_document:            null,
  implementation_sprint:    null,
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const BUSINESS_APPLICATION_REGISTRY: BusinessApplicationManifest[] = [
  DEALER_AGENT,
  ENTERPRISE_DISTRIBUTION,
  WAREHOUSE,
  ACCOUNTING,
  CRM,
  AI_OPERATIONS,
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getBusinessApplication(
  application_id: BusinessApplicationId,
): BusinessApplicationManifest | undefined {
  return BUSINESS_APPLICATION_REGISTRY.find(
    (a) => a.application_id === application_id,
  );
}

export function getActiveBusinessApplications(): BusinessApplicationManifest[] {
  return BUSINESS_APPLICATION_REGISTRY.filter((a) => a.status === "active");
}

export function getPlannedBusinessApplications(): BusinessApplicationManifest[] {
  return BUSINESS_APPLICATION_REGISTRY.filter((a) => a.status === "planned");
}

export function getApplicationsByType(
  type: BusinessApplicationType,
): BusinessApplicationManifest[] {
  return BUSINESS_APPLICATION_REGISTRY.filter((a) => a.type === type);
}

export function getApplicationsRequiringService(
  service: SharedServiceId,
): BusinessApplicationManifest[] {
  return BUSINESS_APPLICATION_REGISTRY.filter((a) =>
    a.required_shared_services.includes(service),
  );
}

export function getApplicationsUsingService(
  service: SharedServiceId,
): BusinessApplicationManifest[] {
  return BUSINESS_APPLICATION_REGISTRY.filter(
    (a) =>
      a.required_shared_services.includes(service) ||
      a.optional_shared_services.includes(service),
  );
}
