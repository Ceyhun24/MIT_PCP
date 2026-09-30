/**
 * Reads a PostGIS point as returned by the API (hex EWKB, e.g.
 * "0101000020E6100000…") and returns { lat, lng }, or null.
 */
export function parseEwkbPoint(hex: string | null | undefined): { lat: number; lng: number } | null {
  if (!hex || !/^[0-9a-fA-F]+$/.test(hex) || hex.length < 42) return null;
  const bytes = new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));
  const view = new DataView(bytes.buffer);
  const le = bytes[0] === 1;
  const type = view.getUint32(1, le);
  if ((type & 0xff) !== 1) return null; // not a Point
  let offset = 5;
  if (type & 0x20000000) offset += 4; // SRID present
  if (bytes.length < offset + 16) return null;
  const lng = view.getFloat64(offset, le);
  const lat = view.getFloat64(offset + 8, le);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
