"use client";

// Leaflet map with one marker per result. Loaded only in the browser.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, CircleMarker, ZoomControl } from "react-leaflet";
import { t } from "@/lib/i18n";
import { formatPriceRange } from "@/lib/format";
import type { SearchResult } from "@/lib/types";

export const BAKU_CENTER: [number, number] = [40.4093, 49.8671];

const pin = (selected: boolean) =>
  L.divIcon({
    className: "",
    html: `<span class="kt-pin${selected ? " kt-pin--selected" : ""}"></span>`,
    iconSize: selected ? [26, 26] : [18, 18],
    iconAnchor: selected ? [13, 13] : [9, 9],
  });

export const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Zoom buttons and attribution with Azerbaijani labels (Leaflet's defaults are English). */
export function MapChrome() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  }, [map]);
  return <ZoomControl position="topleft" zoomInTitle={t("map.zoomIn")} zoomOutTitle={t("map.zoomOut")} />;
}

function FitBounds({ points, origin }: { points: [number, number][]; origin?: [number, number] }) {
  const map = useMap();
  const key = JSON.stringify([points, origin]);
  useEffect(() => {
    const all = origin ? [...points, origin] : points;
    const fit = () => {
      map.invalidateSize();
      if (all.length === 0) map.setView(BAKU_CENTER, 11);
      else if (all.length === 1) map.setView(all[0], 14);
      else map.fitBounds(L.latLngBounds(all), { padding: [30, 30], maxZoom: 15 });
    };
    fit();
    // The map box can change size after load (or be hidden in the mobile
    // "Siyahı" tab); refit whenever it gets a new size.
    let last = "";
    const observer = new ResizeObserver(([entry]) => {
      const size = `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`;
      if (size !== last && entry.contentRect.width > 0) {
        last = size;
        fit();
      }
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function PanTo({ target }: { target?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (target && !map.getBounds().contains(target)) map.panTo(target);
  }, [target, map]);
  return null;
}

type Props = {
  results: SearchResult[];
  selectedId?: string;
  onSelect: (id: string) => void;
  origin?: [number, number];
};

export default function ResultsMap({ results, selectedId, onSelect, origin }: Props) {
  const located = useMemo(() => results.filter((r) => r.lat !== null && r.lng !== null), [results]);
  const points = useMemo(() => located.map((r) => [r.lat!, r.lng!] as [number, number]), [located]);
  const selected = located.find((r) => r.id === selectedId);

  return (
    <MapContainer center={BAKU_CENTER} zoom={11} scrollWheelZoom zoomControl={false} className="h-full w-full" aria-label={t("results.map")}>
      <MapChrome />
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <FitBounds points={points} origin={origin} />
      <PanTo target={selected ? [selected.lat!, selected.lng!] : undefined} />
      {origin && <CircleMarker center={origin} radius={7} pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.9 }} />}
      {located.map((r) => (
        <Marker
          key={r.id}
          position={[r.lat!, r.lng!]}
          icon={pin(r.id === selectedId)}
          zIndexOffset={r.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(r.id) }}
          title={r.name}
        >
          <Popup>
            <strong>{r.name}</strong>
            {formatPriceRange(r.price_min_azn, r.price_max_azn) && (
              <div>
                {formatPriceRange(r.price_min_azn, r.price_max_azn)} / {t("center.perMonth")}
              </div>
            )}
            <Link href={`/merkez/${r.slug}`}>{t("results.details")} →</Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
