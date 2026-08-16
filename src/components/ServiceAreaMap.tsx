"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { siteConfig } from "@/config/siteConfig";

const storeIcon = L.divIcon({
  className: "",
  html: `<div style="
      width: 38px; height: 38px;
      display: flex; align-items: center; justify-content: center;
      background: #a44819;
      border: 3px solid #fff;
      border-radius: 9999px;
      box-shadow: 0 10px 20px -8px rgba(74,44,18,0.6);
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 7l1.5-4h15L21 7" />
        <path d="M3 7a2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0" />
        <path d="M4.5 7.5V20h15V7.5" />
        <path d="M9.5 20v-6h5v6" />
      </svg>
    </div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

interface ServiceAreaMapProps {
  radiusKm: number;
}

function ServiceAreaMap({ radiusKm }: ServiceAreaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const center: L.LatLngTuple = [siteConfig.contact.lat, siteConfig.contact.lng];

    // Circle.getBounds() projects through the map's current view, so the map
    // needs a center/zoom set *before* it's used — otherwise it throws.
    const map = L.map(containerRef.current, { center, zoom: 13, zoomControl: false });
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    // CartoDB's light "Positron" basemap — free, no API key, and far less
    // visually busy than raw OSM tiles for a clean delivery-zone overview.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    const circle = L.circle(center, {
      radius: radiusKm * 1000,
      color: "#a44819",
      weight: 2,
      fillColor: "#ba6b26",
      fillOpacity: 0.12,
    }).addTo(map);
    L.marker(center, { icon: storeIcon }).addTo(map);

    // The container can still be mid-transition (framer-motion scale-in) when
    // this runs, so make sure Leaflet has the real size before fitting bounds.
    requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(circle.getBounds(), { padding: [16, 16] });
    });

    return () => {
      map.remove();
    };
  }, [radiusKm]);

  return <div ref={containerRef} className="h-full w-full" />;
}

export default ServiceAreaMap;
