"use client";

// Small map with a single pin, used on the listing page.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { MapChrome, TILE_ATTRIBUTION, TILE_URL } from "@/components/ResultsMap";

const icon = L.divIcon({ className: "", html: '<span class="kt-pin kt-pin--selected"></span>', iconSize: [26, 26], iconAnchor: [13, 13] });

export default function PinMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  return (
    <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} zoomControl={false} className="h-full w-full" aria-label={label}>
      <MapChrome />
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <Marker position={[lat, lng]} icon={icon} title={label} />
    </MapContainer>
  );
}
