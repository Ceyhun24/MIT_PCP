"use client";

// Map where the provider clicks (or drags the pin) to set the center's location.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { BAKU_CENTER, MapChrome, TILE_ATTRIBUTION, TILE_URL } from "@/components/ResultsMap";

const icon = L.divIcon({ className: "", html: '<span class="kt-pin kt-pin--selected"></span>', iconSize: [26, 26], iconAnchor: [13, 13] });

function ClickToSet({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onChange(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lng !== null && !map.getBounds().contains([lat, lng])) map.setView([lat, lng], Math.max(map.getZoom(), 14));
  }, [lat, lng, map]);
  return null;
}

type Props = { lat: number | null; lng: number | null; onChange: (lat: number, lng: number) => void; label: string };

export default function LocationPicker({ lat, lng, onChange, label }: Props) {
  const has = lat !== null && lng !== null;
  return (
    <MapContainer center={has ? [lat, lng] : BAKU_CENTER} zoom={has ? 15 : 11} zoomControl={false} className="h-full w-full" aria-label={label}>
      <MapChrome />
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <ClickToSet onChange={onChange} />
      <Recenter lat={lat} lng={lng} />
      {has && (
        <Marker
          position={[lat, lng]}
          icon={icon}
          draggable
          eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onChange(p.lat, p.lng); } }}
        />
      )}
    </MapContainer>
  );
}
