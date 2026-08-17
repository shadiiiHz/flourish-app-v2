"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search } from "lucide-react";

const TEHRAN_CENTER: L.LatLngTuple = [35.6892, 51.389];

export interface PickedLocation {
  lng: number;
  lat: number;
  address?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface AddressMapPickerProps {
  initialLocation?: PickedLocation | null;
  onLocationChange: (location: PickedLocation) => void;
}

const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.716 23.284 0 15 0z" fill="#a44819"/>
    <circle cx="15" cy="15" r="5.5" fill="#fff"/>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

function AddressMapPicker({ initialLocation, onLocationChange }: AddressMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  // Only the value at mount time matters — the map is initialized once and
  // shouldn't re-center if the picked location changes afterwards.
  const initialLocationRef = useRef(initialLocation);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initial = initialLocationRef.current;
    const center: L.LatLngTuple = initial ? [initial.lat, initial.lng] : TEHRAN_CENTER;

    const map = L.map(containerRef.current, {
      center,
      zoom: initial ? 16 : 11,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(center, { icon: pinIcon, draggable: true }).addTo(map);

    const reverseGeocode = async (lat: number, lng: number) => {
      onLocationChangeRef.current({ lng, lat });
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fa`,
        );
        const data = await res.json();
        if (data?.display_name) {
          onLocationChangeRef.current({ lng, lat, address: data.display_name });
        }
      } catch {
        // reverse geocoding is a convenience only — silently ignore failures
      }
    };

    marker.on("dragend", () => {
      const { lat, lng } = marker.getLatLng();
      reverseGeocode(lat, lng);
    });
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Debounced live suggestions while typing.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&accept-language=fa&countrycodes=ir&limit=5`,
          { signal: controller.signal },
        );
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
      } catch {
        // suggestions are a convenience only — silently ignore failures
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selectResult = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    mapRef.current?.flyTo([lat, lng], 15);
    markerRef.current?.setLatLng([lat, lng]);
    onLocationChangeRef.current({ lng, lat, address: result.display_name });
    setQuery(result.display_name);
    setShowSuggestions(false);
  };

  const handleSearch = async () => {
    if (!query.trim() || searching) return;
    if (suggestions.length > 0) {
      selectResult(suggestions[0]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&accept-language=fa&countrycodes=ir&limit=1`,
      );
      const data = await res.json();
      if (data?.[0]) selectResult(data[0]);
    } catch {
      // search is a convenience only — silently ignore failures
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="relative h-72 overflow-hidden rounded-2xl border border-cocoa-900/10 sm:h-96">
      <div ref={containerRef} className="h-full w-full" />
      <div ref={searchWrapperRef} className="absolute inset-x-3 top-3 z-[500]">
        <div className="flex items-center gap-2 rounded-full border border-white/40 bg-white/90 px-3 py-2 shadow-md backdrop-blur-xl">
          <button
            type="button"
            onClick={handleSearch}
            aria-label="جستجو"
            className="text-cocoa-500 transition hover:text-sand-500"
          >
            <Search className="h-4 w-4" />
          </button>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
            placeholder="جستجو در نقشه"
            className="w-full bg-transparent text-sm text-cocoa-900 outline-none placeholder:text-cocoa-500/50"
          />
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul className="mt-2 max-h-52 overflow-y-auto rounded-2xl border border-white/40 bg-white/95 py-1.5 shadow-lg backdrop-blur-xl">
            {suggestions.map((s, i) => (
              <li key={`${s.lat}-${s.lon}-${i}`}>
                <button
                  type="button"
                  onClick={() => selectResult(s)}
                  className="block w-full px-4 py-2 text-right text-sm text-cocoa-700 transition hover:bg-sand-50"
                >
                  {s.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AddressMapPicker;
