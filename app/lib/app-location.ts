export type AppPosition = { lat: number; lng: number };
export type LocationResult = { position: AppPosition; error?: never } | { position?: never; error: "denied" | "unavailable" | "timeout" };
type LocationProvider = Pick<Geolocation, "getCurrentPosition">;

/** Shared only in memory. Coordinates never enter browser storage. */
export function createLocationSession() {
  let request: Promise<LocationResult> | undefined;
  return (provider: LocationProvider | undefined, retry = false): Promise<LocationResult> => {
    if (request && !retry) return request;
    request = new Promise(resolve => {
      if (!provider) return resolve({ error: "unavailable" });
      try {
        provider.getCurrentPosition(({ coords }) => {
          const position = { lat: coords.latitude, lng: coords.longitude };
          resolve(Number.isFinite(position.lat) && Number.isFinite(position.lng) && Math.abs(position.lat)<=90 && Math.abs(position.lng)<=180 ? { position } : { error: "unavailable" });
        }, error => resolve({ error: error.code === 1 ? "denied" : error.code === 3 ? "timeout" : "unavailable" }),
        { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 });
      } catch { resolve({ error: "unavailable" }); }
    });
    return request;
  };
}
export const requestAppLocation = createLocationSession();

export function nearestLocationPlace<T extends AppPosition>(places: T[], position: AppPosition, maxKm = 20): { place: T; km: number } | null {
  const radians = (n: number) => n * Math.PI / 180;
  const distance = (p: AppPosition) => {
    const a = Math.sin(radians(p.lat-position.lat)/2)**2 + Math.cos(radians(position.lat))*Math.cos(radians(p.lat))*Math.sin(radians(p.lng-position.lng)/2)**2;
    return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1,a)), Math.sqrt(Math.max(0,1-a)));
  };
  const nearest = places.map(place => ({ place, km: distance(place) })).sort((a,b)=>a.km-b.km)[0];
  return nearest && nearest.km <= maxKm ? nearest : null;
}
