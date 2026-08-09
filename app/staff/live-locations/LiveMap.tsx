"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type LiveMapPoint = {
  id?: string;
  entityId?: string;
  latitude: number;
  longitude: number;
  label?: string;
  subtitle?: string;
  capturedAt?: string | null;
  source?: string;
  accuracy?: number | null;
  markerType?:
    | "STAFF"
    | "BROKER_LIVE"
    | "REGISTERED_AGENT"
    | "REGISTERED_AGENT_VISITED"
    | "REGISTERED_AGENT_SERVICED"
    | "BROKER_CUSTOMER"
    | "BROKER_CUSTOMER_SERVICED"
    | "CUSTOMER"
    | "HISTORY";
};

type PlottedPoint = LiveMapPoint & {
  displayLatitude: number;
  displayLongitude: number;
};

type MarkerConfiguration = {
  colour: string;
  icon: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markerConfiguration(
  type: LiveMapPoint["markerType"],
): MarkerConfiguration {
  switch (type) {
    case "STAFF":
      return { colour: "#08795c", icon: "S" };
    case "BROKER_LIVE":
      return { colour: "#5d3fc4", icon: "BL" };
    case "REGISTERED_AGENT":
      return { colour: "#6d4bd6", icon: "A" };
    case "REGISTERED_AGENT_VISITED":
      return { colour: "#d48a18", icon: "V" };
    case "REGISTERED_AGENT_SERVICED":
      return { colour: "#0a8f69", icon: "✓" };
    case "BROKER_CUSTOMER":
      return { colour: "#2563a8", icon: "B" };
    case "BROKER_CUSTOMER_SERVICED":
      return { colour: "#0a8f69", icon: "✓" };
    case "CUSTOMER":
      return { colour: "#e48b2b", icon: "C" };
    default:
      return { colour: "#58736a", icon: "•" };
  }
}

function markerHtml(
  type: LiveMapPoint["markerType"],
  label: string,
): string {
  const configuration = markerConfiguration(type);
  const safeLabel = escapeHtml(label.slice(0, 34));

  return `
    <div style="
      position:relative;
      width:46px;
      height:56px;
      display:flex;
      align-items:flex-start;
      justify-content:center;
      filter:drop-shadow(0 8px 10px rgba(0,0,0,.24));
      pointer-events:auto;
    ">
      <div style="
        width:37px;
        height:37px;
        display:grid;
        place-items:center;
        border:3px solid white;
        border-radius:50% 50% 50% 0;
        color:white;
        background:${configuration.colour};
        font:900 10px/1 Inter,system-ui,sans-serif;
        transform:rotate(-45deg);
      ">
        <span style="transform:rotate(45deg)">${configuration.icon}</span>
      </div>
      <span style="
        position:absolute;
        top:40px;
        left:50%;
        max-width:132px;
        padding:4px 7px;
        overflow:hidden;
        border:1px solid rgba(255,255,255,.92);
        border-radius:999px;
        color:#18372f;
        background:white;
        box-shadow:0 4px 14px rgba(0,0,0,.16);
        font:800 8px/1.2 Inter,system-ui,sans-serif;
        text-overflow:ellipsis;
        white-space:nowrap;
        transform:translateX(-50%);
      ">${safeLabel}</span>
    </div>
  `;
}

function ensureLeafletCss(): void {
  if (document.querySelector('link[data-simamia-leaflet="true"]')) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  link.dataset.simamiaLeaflet = "true";
  document.head.appendChild(link);
}

function coordinateIsValid(point: LiveMapPoint): boolean {
  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001)
  );
}

function capturedAtTime(point: LiveMapPoint): number {
  if (!point.capturedAt) return 0;
  const parsed = new Date(point.capturedAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalisePoints(points: LiveMapPoint[]): LiveMapPoint[] {
  const valid = points.filter(coordinateIsValid);
  const newestStaff = valid
    .filter((point) => point.markerType === "STAFF")
    .sort((left, right) => capturedAtTime(right) - capturedAtTime(left))[0];

  const seen = new Set<string>();
  const remaining: LiveMapPoint[] = [];

  for (const point of valid) {
    if (point.markerType === "STAFF") continue;

    const key = String(
      point.id ||
        `${point.markerType || "POINT"}:${point.entityId || point.label || ""}:${Number(point.latitude).toFixed(7)}:${Number(point.longitude).toFixed(7)}`,
    );

    if (seen.has(key)) continue;
    seen.add(key);
    remaining.push(point);
  }

  return newestStaff ? [newestStaff, ...remaining] : remaining;
}

function isApproximateSource(source: unknown): boolean {
  return String(source || "").toUpperCase() === "DATABASE_ADDRESS_APPROXIMATE";
}

function spreadCoincidentPoints(points: LiveMapPoint[]): PlottedPoint[] {
  const groups = new Map<string, LiveMapPoint[]>();

  for (const point of points) {
    const key = `${Number(point.latitude).toFixed(6)}:${Number(point.longitude).toFixed(6)}`;
    const rows = groups.get(key) || [];
    rows.push(point);
    groups.set(key, rows);
  }

  const plotted: PlottedPoint[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (const rows of groups.values()) {
    if (rows.length === 1) {
      const point = rows[0];
      plotted.push({
        ...point,
        displayLatitude: Number(point.latitude),
        displayLongitude: Number(point.longitude),
      });
      continue;
    }

    const ordered = rows.slice().sort((left, right) => {
      if (left.markerType === "STAFF") return -1;
      if (right.markerType === "STAFF") return 1;
      return String(left.label || "").localeCompare(String(right.label || ""));
    });

    let offsetIndex = 0;

    for (const point of ordered) {
      const latitude = Number(point.latitude);
      const longitude = Number(point.longitude);

      // Exact GPS points stay at the exact stored coordinate. Only approximate
      // address points are visually separated when they overlap.
      if (point.markerType === "STAFF" || !isApproximateSource(point.source)) {
        plotted.push({
          ...point,
          displayLatitude: latitude,
          displayLongitude: longitude,
        });
        continue;
      }

      const radiusMetres = 10 + 10 * Math.sqrt(offsetIndex + 1);
      const angle = offsetIndex * goldenAngle;
      const latitudeOffset = (radiusMetres * Math.cos(angle)) / 111_320;
      const longitudeScale = Math.max(
        0.18,
        Math.cos((latitude * Math.PI) / 180),
      );
      const longitudeOffset =
        (radiusMetres * Math.sin(angle)) / (111_320 * longitudeScale);

      plotted.push({
        ...point,
        displayLatitude: latitude + latitudeOffset,
        displayLongitude: longitude + longitudeOffset,
      });
      offsetIndex += 1;
    }
  }

  return plotted;
}

function sourceLabel(source: unknown): string {
  switch (String(source || "").toUpperCase()) {
    case "STAFF_LIVE_DEVICE":
      return "Staff live GPS";
    case "AGENT_LIVE_DEVICE":
      return "Agent live GPS";
    case "AGENT_DEVICE_LAST_KNOWN":
      return "Agent device last known GPS";
    case "BROKER_LIVE_DEVICE":
      return "Broker live GPS";
    case "STAFF_GPS_VERIFIED":
      return "Verified during staff visit";
    case "DATABASE_ADDRESS_APPROXIMATE":
      return "Approximate address location";
    case "DATABASE_COORDINATE":
      return "Saved database coordinate";
    default:
      return String(source || "Location source unavailable").replaceAll("_", " ");
  }
}

function popupHtml(point: PlottedPoint): string {
  const storedLatitude = Number(point.latitude);
  const storedLongitude = Number(point.longitude);
  const wasOffset =
    Math.abs(point.displayLatitude - storedLatitude) > 0.0000001 ||
    Math.abs(point.displayLongitude - storedLongitude) > 0.0000001;

  const capturedAt = point.capturedAt
    ? new Date(point.capturedAt).toLocaleString("en-GB", {
        timeZone: "Africa/Dar_es_Salaam",
      })
    : "";

  const source = point.source
    ? `<br/><small>Source: ${escapeHtml(sourceLabel(point.source))}</small>`
    : "";

  const accuracy =
    point.accuracy != null && Number.isFinite(Number(point.accuracy))
      ? `<br/><small>Accuracy: ${Math.round(Number(point.accuracy))} metres</small>`
      : "";

  const approximateNote = isApproximateSource(point.source)
    ? "<br/><small><strong>Approximate only:</strong> this point came from the saved address, not a live GPS device.</small>"
    : "";

  const overlapNote = wasOffset
    ? "<br/><small>Approximate address markers were separated visually because several records share the same area coordinate.</small>"
    : "";

  return (
    `<strong>${escapeHtml(point.label || "Location")}</strong>` +
    `<br/>${escapeHtml(point.subtitle || "")}` +
    `<br/><small>Stored: ${storedLatitude.toFixed(6)}, ${storedLongitude.toFixed(6)}</small>` +
    source +
    accuracy +
    approximateNote +
    overlapNote +
    (capturedAt ? `<br/><small>${escapeHtml(capturedAt)}</small>` : "")
  );
}

export default function LiveMap({
  points,
  history = [],
  height = 540,
}: {
  points: LiveMapPoint[];
  history?: LiveMapPoint[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const pointLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const lastFitKeyRef = useRef("");
  const resizeFrameRef = useRef<number | null>(null);
  const [mapGeneration, setMapGeneration] = useState(0);

  const pointKey = useMemo(
    () =>
      JSON.stringify(
        points.map((point) => [
          point.id,
          point.entityId,
          point.markerType,
          Number(point.latitude),
          Number(point.longitude),
          point.label,
          point.subtitle,
          point.capturedAt,
          point.source,
          point.accuracy,
        ]),
      ),
    [points],
  );

  const historyKey = useMemo(
    () =>
      JSON.stringify(
        history.map((point) => [
          point.id,
          Number(point.latitude),
          Number(point.longitude),
          point.capturedAt,
        ]),
      ),
    [history],
  );

  useEffect(() => {
    let disposed = false;
    let localMap: any = null;

    async function initialise(): Promise<void> {
      ensureLeafletCss();
      const leaflet = await import("leaflet");

      if (disposed || !containerRef.current) return;
      const container = containerRef.current;

      if ((container as any)._leaflet_id && !mapRef.current) {
        delete (container as any)._leaflet_id;
      }

      localMap = leaflet.map(container, {
        zoomControl: true,
        attributionControl: true,
        // The previous crash came from Leaflet Canvas calling context.save()
        // after a Turbopack remount. Keep every vector layer on SVG instead.
        preferCanvas: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
        zoomAnimation: false,
      });

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        })
        .addTo(localMap);

      const pointLayer = leaflet.layerGroup().addTo(localMap);
      const routeLayer = leaflet.layerGroup().addTo(localMap);

      leafletRef.current = leaflet;
      mapRef.current = localMap;
      pointLayerRef.current = pointLayer;
      routeLayerRef.current = routeLayer;

      localMap.setView([-6.7924, 39.2083], 7, { animate: false });
      setMapGeneration((current) => current + 1);

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        if (!disposed && container.isConnected && mapRef.current === localMap) {
          localMap.invalidateSize({ pan: false, animate: false });
        }
      });
    }

    void initialise();

    return () => {
      disposed = true;

      if (resizeFrameRef.current != null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }

      try {
        pointLayerRef.current?.clearLayers?.();
        routeLayerRef.current?.clearLayers?.();
        localMap?.stop?.();
        localMap?.off?.();
        localMap?.remove?.();
      } catch (cleanupError) {
        console.warn("LEAFLET_CLEANUP_WARNING:", cleanupError);
      }

      pointLayerRef.current = null;
      routeLayerRef.current = null;
      mapRef.current = null;
      leafletRef.current = null;
      lastFitKeyRef.current = "";
    };
  }, []);

  useEffect(() => {
    if (mapGeneration <= 0) return;

    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const pointLayer = pointLayerRef.current;
    const routeLayer = routeLayerRef.current;
    const container = containerRef.current;

    if (!leaflet || !map || !pointLayer || !routeLayer || !container?.isConnected) {
      return;
    }

    try {
      pointLayer.clearLayers();
      routeLayer.clearLayers();

      const normalised = normalisePoints(points);
      const plotted = spreadCoincidentPoints(normalised);
      const validHistory = history.filter(coordinateIsValid);

      const route = validHistory.map(
        (point) =>
          [Number(point.latitude), Number(point.longitude)] as [number, number],
      );

      if (route.length > 1) {
        leaflet
          .polyline(route, {
            color: "#08795c",
            weight: 4,
            opacity: 0.84,
            dashArray: "4 10",
            lineCap: "round",
            interactive: false,
          })
          .addTo(routeLayer);
      }

      const denseMode = plotted.length > 450;

      for (const point of plotted) {
        const configuration = markerConfiguration(point.markerType);
        let marker: any;

        if (
          denseMode &&
          !["STAFF", "BROKER_LIVE"].includes(String(point.markerType))
        ) {
          // No explicit Canvas renderer. Leaflet therefore uses SVG and never
          // calls CanvasRenderingContext2D.save(), which fixes the runtime error.
          marker = leaflet.circleMarker(
            [point.displayLatitude, point.displayLongitude],
            {
              radius:
                point.markerType === "REGISTERED_AGENT_SERVICED" ||
                point.markerType === "BROKER_CUSTOMER_SERVICED"
                  ? 7
                  : 5.5,
              color: "#ffffff",
              weight: 1.5,
              fillColor: configuration.colour,
              fillOpacity: 0.95,
            },
          );

          marker.bindTooltip(escapeHtml(point.label || "Agent"), {
            direction: "top",
            opacity: 0.94,
            sticky: true,
          });
        } else {
          const icon = leaflet.divIcon({
            className: "simamia-leaflet-marker",
            html: markerHtml(point.markerType, point.label || "Location"),
            iconSize: [46, 56],
            iconAnchor: [23, 49],
            popupAnchor: [0, -45],
          });

          marker = leaflet.marker(
            [point.displayLatitude, point.displayLongitude],
            {
              icon,
              keyboard: true,
              riseOnHover: true,
            },
          );
        }

        marker.bindPopup(popupHtml(point), {
          closeButton: true,
          autoPan: true,
          keepInView: true,
        });
        marker.addTo(pointLayer);
      }

      const fitPoints = [
        ...plotted.map(
          (point) =>
            [point.displayLatitude, point.displayLongitude] as [number, number],
        ),
        ...route,
      ];

      const fitKey = JSON.stringify(fitPoints);

      if (fitPoints.length && fitKey !== lastFitKeyRef.current) {
        lastFitKeyRef.current = fitKey;

        if (fitPoints.length === 1) {
          map.setView(fitPoints[0], 15, { animate: false });
        } else {
          map.fitBounds(fitPoints, {
            padding: [42, 42],
            maxZoom: 16,
            animate: false,
          });
        }
      }

      if (resizeFrameRef.current != null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        if (container.isConnected && mapRef.current === map) {
          map.invalidateSize({ pan: false, animate: false });
        }
      });
    } catch (renderError) {
      console.error("LEAFLET_RENDER_ERROR:", renderError);
    }
  }, [mapGeneration, pointKey, historyKey, points, history]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height,
        minHeight: 320,
        borderRadius: 24,
        overflow: "hidden",
        background: "#dfe9e5",
      }}
      aria-label="Staff and assigned agent live location map"
    />
  );
}
