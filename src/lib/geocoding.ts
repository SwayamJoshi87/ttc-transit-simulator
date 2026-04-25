const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lon}&format=json`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "TTC-Transit-Simulator/1.0" },
  });
  if (!res.ok) return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  const data = await res.json();
  return data.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export async function forwardGeocode(query: string): Promise<{ lat: number; lon: number; displayName: string } | null> {
  const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=1&viewbox=-79.8,43.5,-79.0,43.9&bounded=1`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "TTC-Transit-Simulator/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), displayName: data[0].display_name };
}
