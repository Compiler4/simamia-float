function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function formattedDatabaseAddress(input: {
  address?: unknown;
  ward?: unknown;
  district?: unknown;
  region?: unknown;
  city?: unknown;
  location?: unknown;
}): string {
  const parts = [
    input.address,
    input.ward,
    input.district,
    input.city,
    input.region,
    input.location,
    "Tanzania",
  ]
    .map(text)
    .filter(Boolean);

  return Array.from(new Set(parts)).join(", ");
}
