"use client";

import LiveMapBase, {
  type LiveMapPoint,
} from "../live-locations/LiveMap";

type LegacyPoint = {
  latitude: number;
  longitude: number;
  label?: string;
  subtitle?: string;
  capturedAt?: string;
  type?:
    | "staff"
    | "broker"
    | "customer"
    | "agent"
    | "history";
};

function convert(
  point: LegacyPoint,
): LiveMapPoint {
  const markerType: LiveMapPoint["markerType"] =
    point.type === "staff"
      ? "STAFF"
      : point.type === "broker"
        ? "BROKER_CUSTOMER"
        : point.type === "customer"
          ? "CUSTOMER"
          : point.type === "agent"
            ? "REGISTERED_AGENT"
            : "HISTORY";

  return {
    ...point,
    markerType,
  };
}

export default function LiveMap({
  points,
  history = [],
  height = 430,
}: {
  points: LegacyPoint[];
  history?: LegacyPoint[];
  height?: number;
}) {
  return (
    <LiveMapBase
      points={points.map(convert)}
      history={history.map(convert)}
      height={height}
    />
  );
}
