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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markerHtml(type: Point["type"], label: string) {
  const staff = type === "staff";
  const broker = type === "broker";
  const colour = staff ? "#0a8f69" : broker ? "#6d4bd6" : "#e48b2b";
  const icon = staff ? "S" : broker ? "B" : "C";
  return `
    <div style="
      position:relative;
      width:42px;
      height:52px;
      display:flex;
      align-items:flex-start;
      justify-content:center;
      filter:drop-shadow(0 8px 10px rgba(0,0,0,.28));
    ">
      <div style="
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        border:3px solid white;
        border-radius:50% 50% 50% 0;
        color:white;
        background:${colour};
        font:900 12px/1 Inter,system-ui,sans-serif;
        transform:rotate(-45deg);
      ">
        <span style="transform:rotate(45deg)">${icon}</span>
      </div>
      <span style="
        position:absolute;
        top:38px;
        left:50%;
        max-width:110px;
        padding:3px 6px;
        overflow:hidden;
        border-radius:999px;
        color:#18372f;
        background:white;
        box-shadow:0 4px 12px rgba(0,0,0,.18);
        font:800 8px/1.2 Inter,system-ui,sans-serif;
        text-overflow:ellipsis;
        white-space:nowrap;
        transform:translateX(-50%);
      ">${escapeHtml(label)}</span>
    </div>
  `;
}

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
    let cleanup: () => void = () => undefined;

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
        (point) =>
          Number.isFinite(point.latitude) &&
          Number.isFinite(point.longitude),
      );

      const initial: [number, number] = valid.length
        ? [valid[0].latitude, valid[0].longitude]
        : [-6.7924, 39.2083];

      const map = L.map(id, {
        zoomControl: true,
        attributionControl: true,
      }).setView(initial, valid.length ? 13 : 7);

      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      const route = history
        .filter(
          (point) =>
            Number.isFinite(point.latitude) &&
            Number.isFinite(point.longitude),
        )
        .map(
          (point) =>
            [point.latitude, point.longitude] as [number, number],
        );

      if (route.length > 1) {
        L.polyline(route, {
          color: "#0a8f69",
          weight: 4,
          opacity: 0.82,
          dashArray: "3 10",
          lineCap: "round",
        }).addTo(map);

        for (let index = 0; index < route.length; index += 1) {
          if (index % Math.max(1, Math.floor(route.length / 35)) !== 0) {
            continue;
          }
          L.circleMarker(route[index], {
            radius: 3,
            color: "#ffffff",
            weight: 1,
            fillColor: "#0a8f69",
            fillOpacity: 1,
          }).addTo(map);
        }
      }

      for (const point of points) {
        if (
          !Number.isFinite(point.latitude) ||
          !Number.isFinite(point.longitude)
        ) {
          continue;
        }

        const icon = L.divIcon({
          className: "",
          html: markerHtml(point.type, point.label || "Location"),
          iconSize: [42, 52],
          iconAnchor: [21, 46],
          popupAnchor: [0, -42],
        });

        const marker = L.marker(
          [point.latitude, point.longitude],
          { icon },
        ).addTo(map);

        marker.bindPopup(
          `<strong>${escapeHtml(point.label || "Location")}</strong>` +
            `<br/>${escapeHtml(point.subtitle || "")}` +
            (point.capturedAt
              ? `<br/><small>${escapeHtml(
                  new Date(point.capturedAt).toLocaleString(),
                )}</small>`
              : ""),
        );
      }

      if (valid.length > 1) {
        map.fitBounds(
          valid.map(
            (point) =>
              [point.latitude, point.longitude] as [number, number],
          ),
          { padding: [38, 38], maxZoom: 16 },
        );
      }

      window.setTimeout(() => map.invalidateSize(), 160);

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

  return (
    <div
      id={id}
      style={{
        width: "100%",
        height,
        borderRadius: 20,
        overflow: "hidden",
      }}
    />
  );
}
