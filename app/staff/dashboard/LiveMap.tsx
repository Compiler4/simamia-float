"use client";

import { useEffect, useId, useRef } from "react";

type Point = {
  latitude: number;
  longitude: number;
  label?: string;
  subtitle?: string;
  capturedAt?: string;
  type?: "staff" | "broker" | "customer" | "history";
};

export default function LiveMap({
  points,
  history = [],
  height = 430,
}: {
  points: Point[];
  history?: Point[];
  height?: number;
}) {
  const id = `map-${useId().replaceAll(":", "")}`;
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    async function mount() {
      if (!document.querySelector('link[data-leaflet-css="true"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.dataset.leafletCss = "true";
        document.head.appendChild(link);
      }

      const L = await import("leaflet");
      if (cancelled) return;
      const valid = [...points, ...history].filter(
        (point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude),
      );
      const initial: [number, number] = valid.length
        ? [valid[0].latitude, valid[0].longitude]
        : [-6.7924, 39.2083];
      const map = L.map(id, { zoomControl: true, attributionControl: true }).setView(initial, valid.length ? 13 : 7);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      const route = history
        .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
        .map((point) => [point.latitude, point.longitude] as [number, number]);
      if (route.length > 1) {
        L.polyline(route, { color: "#0a8f6a", weight: 4, opacity: 0.78 }).addTo(map);
      }

      for (const point of points) {
        if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) continue;
        const palette: Record<string, string> = {
          staff: "#087f63",
          broker: "#6d4bd6",
          customer: "#e48b2b",
          history: "#5b7180",
        };
        const marker = L.circleMarker([point.latitude, point.longitude], {
          radius: point.type === "staff" ? 10 : 8,
          color: "#ffffff",
          weight: 3,
          fillColor: palette[point.type || "history"],
          fillOpacity: 1,
        }).addTo(map);
        marker.bindPopup(
          `<strong>${escapeHtml(point.label || "Location")}</strong><br/>${escapeHtml(point.subtitle || "")}${point.capturedAt ? `<br/><small>${escapeHtml(new Date(point.capturedAt).toLocaleString())}</small>` : ""}`,
        );
      }

      if (valid.length > 1) {
        map.fitBounds(valid.map((point) => [point.latitude, point.longitude] as [number, number]), { padding: [28, 28] });
      }
      window.setTimeout(() => map.invalidateSize(), 120);
      cleanup = () => {
        map.remove();
        mapRef.current = null;
      };
    }

    void mount();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [id, JSON.stringify(points), JSON.stringify(history)]);

  return <div id={id} style={{ width: "100%", height, borderRadius: 20, overflow: "hidden" }} />;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
