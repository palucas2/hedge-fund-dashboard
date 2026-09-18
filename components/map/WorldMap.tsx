"use client";

import { useEffect, useRef } from "react";
import { CATEGORY_COLORS, TENSION_ZONES } from "@/lib/geo";
import type { NewsPinData } from "@/lib/news";

/** MapLibre GL + OpenFreeMap — tuiles vectorielles gratuites, sans clé, sans compte (voir README). */
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

type ThreatLevel = "critical" | "high" | "medium";
const THREAT_COLORS: Record<ThreatLevel, string> = { critical: "#EF5350", high: "#FFA726", medium: "#FFD54F" };

function polygonCentroid(coords: [number, number][]): [number, number] {
  const pts = coords.slice(0, -1); // le dernier point ferme l'anneau, identique au premier
  const lng = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
  const lat = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  return [lng, lat];
}

/** Regroupe les pins par zone ~4° pour estimer des hotspots dynamiques (densité d'actus = intensité). */
function clusterPins(pins: NewsPinData[]): { lng: number; lat: number; count: number }[] {
  const buckets = new Map<string, { lngSum: number; latSum: number; count: number }>();
  for (const p of pins) {
    const key = `${Math.round(p.lng / 4)}_${Math.round(p.lat / 4)}`;
    const bucket = buckets.get(key) ?? { lngSum: 0, latSum: 0, count: 0 };
    bucket.lngSum += p.lng;
    bucket.latSum += p.lat;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.values())
    .filter((b) => b.count >= 2)
    .map((b) => ({ lng: b.lngSum / b.count, lat: b.latSum / b.count, count: b.count }));
}

function threatLevelForCount(count: number): ThreatLevel {
  if (count >= 7) return "critical";
  if (count >= 4) return "high";
  return "medium";
}

export default function WorldMap({ pins }: { pins: NewsPinData[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    import("maplibre-gl/dist/maplibre-gl.css");
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [30, 25],
        zoom: 1.4,
        attributionControl: false,
      });
      mapRef.current = map;

      map.on("style.load", () => {
        map.setProjection({ type: "globe" });
        map.setSky({
          "sky-color": "#050609",
          "horizon-color": "#12141c",
          "sky-horizon-blend": 0.6,
          "atmosphere-blend": 0.8,
        });
      });

      map.on("load", () => {
        // Zones de tension permanentes (spec Module 1) — ping radar circulaire
        map.addSource("tension-zones", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: TENSION_ZONES.map((z) => {
              const [lng, lat] = polygonCentroid(z.coordinates);
              return { type: "Feature", properties: { label: z.label }, geometry: { type: "Point", coordinates: [lng, lat] } };
            }),
          },
        });
        map.addLayer({
          id: "tension-zones-glow",
          type: "circle",
          source: "tension-zones",
          paint: {
            "circle-color": "#EF5350",
            "circle-blur": 0.8,
            "circle-radius": 45,
            "circle-opacity": 0.35,
          },
        });
        map.addLayer({
          id: "tension-zones-ring",
          type: "circle",
          source: "tension-zones",
          paint: {
            "circle-color": "transparent",
            "circle-radius": 20,
            "circle-stroke-color": "#EF5350",
            "circle-stroke-width": 1.5,
            "circle-stroke-opacity": 0.8,
          },
        });

        // Hotspots dynamiques dérivés de la densité de news réelles (voir clusterPins)
        map.addSource("news-hotspots", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "news-hotspots-glow",
          type: "circle",
          source: "news-hotspots",
          paint: {
            "circle-color": ["get", "color"],
            "circle-blur": 0.9,
            "circle-radius": ["interpolate", ["linear"], ["get", "count"], 2, 24, 10, 55],
            "circle-opacity": 0.3,
          },
        });

        let t = 0;
        function pulse() {
          t += 0.05;
          const wave = (Math.sin(t) + 1) / 2; // 0..1
          if (map.getLayer("tension-zones-glow")) {
            map.setPaintProperty("tension-zones-glow", "circle-opacity", 0.2 + wave * 0.3);
            map.setPaintProperty("tension-zones-ring", "circle-radius", 16 + wave * 10);
            map.setPaintProperty("tension-zones-ring", "circle-stroke-opacity", 0.9 - wave * 0.5);
          }
          if (map.getLayer("news-hotspots-glow")) {
            map.setPaintProperty("news-hotspots-glow", "circle-opacity", 0.18 + wave * 0.22);
          }
          animFrameRef.current = requestAnimationFrame(pulse);
        }
        pulse();
      });
    });

    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function updateHotspots() {
      if (!map.getSource("news-hotspots")) return;
      const clusters = clusterPins(pins);
      map.getSource("news-hotspots").setData({
        type: "FeatureCollection",
        features: clusters.map((c) => ({
          type: "Feature",
          properties: { count: c.count, color: THREAT_COLORS[threatLevelForCount(c.count)] },
          geometry: { type: "Point", coordinates: [c.lng, c.lat] },
        })),
      });
    }

    if (map.isStyleLoaded()) updateHotspots();
    else map.once("load", updateHotspots);

    import("maplibre-gl").then((maplibregl) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      pins.forEach((pin) => {
        const el = document.createElement("div");
        el.style.width = "12px";
        el.style.height = "12px";
        el.style.borderRadius = "50%";
        el.style.background = CATEGORY_COLORS[pin.category];
        el.style.border = "2px solid rgba(255,255,255,0.8)";
        el.style.boxShadow = `0 0 8px 2px ${CATEGORY_COLORS[pin.category]}`;
        el.style.cursor = "pointer";

        const popup = new maplibregl.Popup({ offset: 14, closeButton: true }).setHTML(
          `<div style="font-family:sans-serif;max-width:220px">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px">${escapeHtml(pin.title)}</div>
            <div style="font-size:11px;color:#9396a1;margin-bottom:6px">${escapeHtml(pin.source)} — ${new Date(pin.publishedAt).toLocaleString("fr-FR")}</div>
            <div style="font-size:12px;margin-bottom:6px">${escapeHtml(pin.summary)}</div>
            <a href="${pin.url}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#5a8de8">Lire l'article →</a>
          </div>`
        );

        const marker = new maplibregl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).setPopup(popup).addTo(map);
        markersRef.current.push(marker);
      });
    });
  }, [pins]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full rounded-card border border-border"
        style={{
          background:
            "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.6) 50%, transparent), radial-gradient(1px 1px at 70% 65%, rgba(255,255,255,0.5) 50%, transparent), radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.4) 50%, transparent), radial-gradient(1px 1px at 85% 15%, rgba(255,255,255,0.5) 50%, transparent), radial-gradient(1px 1px at 55% 45%, rgba(255,255,255,0.3) 50%, transparent), #050609",
          backgroundSize: "200px 200px",
        }}
      />
      <div className="absolute bottom-4 left-4 z-10 rounded-card border border-border bg-card/90 p-3 text-xs backdrop-blur">
        <div className="mb-1.5 font-medium text-text-primary">Threat level</div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-text-secondary">
            <span className="h-2 w-2 rounded-full" style={{ background: THREAT_COLORS.critical }} /> Critical
          </div>
          <div className="flex items-center gap-1.5 text-text-secondary">
            <span className="h-2 w-2 rounded-full" style={{ background: THREAT_COLORS.high }} /> High
          </div>
          <div className="flex items-center gap-1.5 text-text-secondary">
            <span className="h-2 w-2 rounded-full" style={{ background: THREAT_COLORS.medium }} /> Medium
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
