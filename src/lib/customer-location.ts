export interface CustomerLocation {
  lat: number;
  lng: number;
  city: string;
  address?: string;
  source: "gps" | "manual" | "ip";
  timestamp?: number;
}

export const STORAGE_LOCATION_KEY = "EXPIRYGO_CUSTOMER_LOCATION";

export const POPULAR_CITIES: CustomerLocation[] = [
  {
    city: "Madurai (Goripalayam)",
    address: "Goripalayam, Madurai, Tamil Nadu",
    lat: 9.9252,
    lng: 78.1198,
    source: "manual",
  },
  {
    city: "Theni / Andippatti",
    address: "Theni & Andippatti, Tamil Nadu",
    lat: 9.9958,
    lng: 77.6231,
    source: "manual",
  },
  {
    city: "Coimbatore (RS Puram)",
    address: "RS Puram, Coimbatore, Tamil Nadu",
    lat: 11.0168,
    lng: 76.9558,
    source: "manual",
  },
  {
    city: "Chennai (Anna Nagar)",
    address: "Anna Nagar, Chennai, Tamil Nadu",
    lat: 13.0850,
    lng: 80.2100,
    source: "manual",
  },
  {
    city: "Chennai (T. Nagar)",
    address: "T. Nagar, Chennai, Tamil Nadu",
    lat: 13.0418,
    lng: 80.2341,
    source: "manual",
  },
  {
    city: "Tiruchirappalli (Trichy)",
    address: "Central Bus Stand, Trichy, Tamil Nadu",
    lat: 10.7905,
    lng: 78.7047,
    source: "manual",
  },
  {
    city: "Salem (Four Roads)",
    address: "Four Roads, Salem, Tamil Nadu",
    lat: 11.6643,
    lng: 78.1460,
    source: "manual",
  },
  {
    city: "Dindigul (Bazaar)",
    address: "Main Bazaar, Dindigul, Tamil Nadu",
    lat: 10.3673,
    lng: 77.9803,
    source: "manual",
  },
  {
    city: "Tirunelveli (Town)",
    address: "Tirunelveli Town, Tamil Nadu",
    lat: 8.7139,
    lng: 77.7567,
    source: "manual",
  },
  {
    city: "Erode (Central)",
    address: "Central Market, Erode, Tamil Nadu",
    lat: 11.3410,
    lng: 77.7172,
    source: "manual",
  },
  {
    city: "Bengaluru (Indiranagar)",
    address: "Indiranagar, Bengaluru, Karnataka",
    lat: 12.9784,
    lng: 77.6408,
    source: "manual",
  },
  {
    city: "Bengaluru (Koramangala)",
    address: "Koramangala, Bengaluru, Karnataka",
    lat: 12.9352,
    lng: 77.6245,
    source: "manual",
  },
  {
    city: "Kochi (Marine Drive)",
    address: "Marine Drive, Ernakulam, Kochi, Kerala",
    lat: 9.9784,
    lng: 76.2755,
    source: "manual",
  },
  {
    city: "Hyderabad (HITEC City)",
    address: "HITEC City, Madhapur, Hyderabad, Telangana",
    lat: 17.4474,
    lng: 78.3762,
    source: "manual",
  },
  {
    city: "Mumbai (Bandra West)",
    address: "Bandra West, Mumbai, Maharashtra",
    lat: 19.0596,
    lng: 72.8295,
    source: "manual",
  },
  {
    city: "Delhi NCR (Connaught Place)",
    address: "Connaught Place, New Delhi",
    lat: 28.6315,
    lng: 77.2167,
    source: "manual",
  },
];

export function getStoredLocation(): CustomerLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") {
      return parsed as CustomerLocation;
    }
  } catch {
    // ignore
  }
  return null;
}

export function setStoredLocation(loc: CustomerLocation): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CustomerLocation = {
      ...loc,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_LOCATION_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("EXPIRYGO_LOCATION_CHANGED", { detail: payload }));
  } catch {
    // ignore
  }
}

export async function searchNominatimLocations(query: string): Promise<CustomerLocation[]> {
  const clean = query.trim();
  if (!clean || clean.length < 2) return [];

  // 1. Quick match against built-in popular cities
  const lower = clean.toLowerCase();
  const directMatches = POPULAR_CITIES.filter(
    (c) =>
      c.city.toLowerCase().includes(lower) ||
      (c.address && c.address.toLowerCase().includes(lower))
  );

  try {
    // 2. Query OpenStreetMap Nominatim for real-time worldwide & India geocoding
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(
      clean
    )}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept-Language": "en",
        "User-Agent": "ExpiryGo-FoodRescue/1.0",
      },
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const fetchedResults: CustomerLocation[] = data.map((item: any) => {
          const addr = item.address || {};
          const locality =
            addr.suburb ||
            addr.neighbourhood ||
            addr.residential ||
            addr.quarter ||
            addr.village ||
            "";
          const city =
            addr.city ||
            addr.town ||
            addr.county ||
            addr.state_district ||
            item.name ||
            clean;
          const state = addr.state || "";

          let displayName = locality ? `${locality}, ${city}` : city;
          if (state && !displayName.includes(state)) {
            displayName = `${displayName}, ${state}`;
          }

          return {
            city: displayName,
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            source: "manual",
          };
        });

        // Combine direct popular matches (deduplicating) with nominatim results
        const combined = [...directMatches];
        for (const item of fetchedResults) {
          const exists = combined.some(
            (c) => Math.abs(c.lat - item.lat) < 0.01 && Math.abs(c.lng - item.lng) < 0.01
          );
          if (!exists) {
            combined.push(item);
          }
        }
        return combined.slice(0, 8);
      }
    }
  } catch {
    // Fall back to direct matches if offline or timeout
  }

  return directMatches;
}

