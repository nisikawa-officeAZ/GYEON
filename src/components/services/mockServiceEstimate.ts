export const SERVICE_CATEGORIES = [
  "Coating",
  "PPF",
  "Window Film",
  "Interior",
  "Wheel Coating",
  "Glass Coating",
  "Maintenance",
] as const;

export type ServiceCategory = typeof SERVICE_CATEGORIES[number];

export const BODY_SIZES = ["SS", "S", "M", "ML", "L", "LL", "XL"] as const;

export type BodySize = typeof BODY_SIZES[number];

// Base prices per category × body size
export const BASE_PRICES: Record<ServiceCategory, Record<BodySize, number>> = {
  "Coating":       { SS: 55000,  S: 65000,  M: 75000,  ML: 85000,  L: 95000,  LL: 110000, XL: 130000 },
  "PPF":           { SS: 80000,  S: 95000,  M: 110000, ML: 130000, L: 150000, LL: 180000, XL: 220000 },
  "Window Film":   { SS: 35000,  S: 40000,  M: 45000,  ML: 50000,  L: 55000,  LL: 65000,  XL: 75000  },
  "Interior":      { SS: 30000,  S: 35000,  M: 40000,  ML: 45000,  L: 50000,  LL: 60000,  XL: 70000  },
  "Wheel Coating": { SS: 20000,  S: 20000,  M: 22000,  ML: 22000,  L: 25000,  LL: 25000,  XL: 28000  },
  "Glass Coating": { SS: 18000,  S: 20000,  M: 22000,  ML: 24000,  L: 26000,  LL: 28000,  XL: 32000  },
  "Maintenance":   { SS: 15000,  S: 18000,  M: 20000,  ML: 22000,  L: 25000,  LL: 28000,  XL: 32000  },
};

export const SERVICE_OPTIONS = [
  { key: "ironRemoval",          label: "Iron Removal",          price: 8000  },
  { key: "contaminationRemoval", label: "Contamination Removal", price: 10000 },
  { key: "hardPolish",           label: "Hard Polish",           price: 25000 },
  { key: "touchUpPaint",         label: "Touch-up Paint",        price: 15000 },
  { key: "additionalLabor",      label: "Additional Labor",      price: 12000 },
] as const;

export type OptionKey = typeof SERVICE_OPTIONS[number]["key"];

export const DISCOUNT_STEPS = [0, 5, 10, 15, 20] as const;

export const MOCK_SERVICE_ESTIMATE = {
  category:  "Coating" as ServiceCategory,
  bodySize:  "M" as BodySize,
  basePrice: 75000,
  options: {
    ironRemoval:          true,
    contaminationRemoval: false,
    hardPolish:           true,
    touchUpPaint:         false,
    additionalLabor:      false,
  },
  optionsTotal:  33000,
  discountRate:  10,
  discount:      10800,
  tax:            9720,
  total:         106920,
};
