function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function formattedDatabaseAddress(input: {
  name?: unknown;
  address?: unknown;
  ward?: unknown;
  district?: unknown;
  region?: unknown;
  city?: unknown;
  location?: unknown;
}): string {
  const parts = [
    input.name,
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

export type TanzaniaGeocodeResult = {
  latitude: number;
  longitude: number;
  displayName: string;
  query: string;
  precision: "STREET" | "WARD" | "DISTRICT" | "REGION";
};

function precisionFromAddress(input: {
  address?: unknown;
  ward?: unknown;
  district?: unknown;
  region?: unknown;
}): TanzaniaGeocodeResult["precision"] {
  if (text(input.address)) return "STREET";
  if (text(input.ward)) return "WARD";
  if (text(input.district)) return "DISTRICT";
  return "REGION";
}

export async function geocodeTanzaniaAddress(input: {
  name?: unknown;
  businessName?: unknown;
  address?: unknown;
  ward?: unknown;
  district?: unknown;
  region?: unknown;
  city?: unknown;
  location?: unknown;
  locationName?: unknown;
}): Promise<TanzaniaGeocodeResult | null> {
  const query = formattedDatabaseAddress({
    name: input.businessName || input.name,
    address: input.address || input.locationName,
    ward: input.ward,
    district: input.district,
    city: input.city,
    region: input.region,
    location: input.location,
  });

  if (!query || query === "Tanzania") return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "tz");

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "SimamiaFloat/3.0 geocoder",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GEOCODER_HTTP_${response.status}`);
  }

  const [match] = (await response.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
  }>;

  if (!match?.lat || !match.lon) return null;

  const latitude = Number(match.lat);
  const longitude = Number(match.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    displayName: match.display_name || query,
    query,
    precision: precisionFromAddress(input),
  };
}
