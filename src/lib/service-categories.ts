// Service categories for the Bloom booking system
// These categories are used in the admin services page and booking flow

export const SERVICE_CATEGORIES = [
  // Primary lash services (displayed first)
  { value: "LASH_EXTENSION", label: "Lash Extensions", icon: "eye" },
  { value: "LASH_FILL", label: "Lash Fills", icon: "refresh-cw" },
  { value: "LASH_LIFT", label: "Lash Lifts/Tints", icon: "trending-up" },
  // Brow & Face
  { value: "BROW", label: "Brow Services", icon: "eye" },
  { value: "FACIALS", label: "Facials", icon: "sparkle" },
  { value: "PERMANENT_MAKEUP", label: "Permanent Make Up Services", icon: "pen-tool" },
  // Waxing
  { value: "FACIAL_WAXING", label: "Facial Waxing", icon: "scissors" },
  { value: "UPPER_BODY_WAXING", label: "Upper Body Waxing", icon: "user" },
  { value: "LOWER_BODY_WAXING", label: "Lower Body Waxing", icon: "user" },
  { value: "WAXING_GENERAL", label: "Waxing Packages", icon: "zap" },
  // Other
  { value: "OTHER", label: "Other Services", icon: "package" },
] as const;

export type ServiceCategory = typeof SERVICE_CATEGORIES[number]["value"];

// Helper to get category label from value
export function getCategoryLabel(value: string): string {
  const category = SERVICE_CATEGORIES.find((c) => c.value === value);
  return category?.label || value;
}

// Helper to get all category values
export function getCategoryValues(): string[] {
  return SERVICE_CATEGORIES.map((c) => c.value);
}
