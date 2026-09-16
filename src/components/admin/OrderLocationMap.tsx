"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { pinIcon } from "@/components/AddressMapPicker";

interface OrderLocationMapProps {
  lat: number;
  lng: number;
}

/** Read-only map showing the exact point the customer placed their pin at — no dragging, no click-to-move. */
function OrderLocationMap({ lat, lng }: OrderLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const center: L.LatLngTuple = [lat, lng];

    const map = L.map(containerRef.current, {
      center,
      zoom: 16,
      zoomControl: false,
      dragging: true,
      scrollWheelZoom: true,
    });
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    L.marker(center, { icon: pinIcon }).addTo(map);

    // The container can still be mid-transition (dialog open animation) when
    // this runs, so make sure Leaflet has the real size before rendering tiles.
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
    };
  }, [lat, lng]);

  return <div ref={containerRef} className="h-full w-full" />;
}

export default OrderLocationMap;
