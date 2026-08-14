import { prisma } from "./prisma.js";
import { env } from "./env.js";

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export async function getSettings() {
  return prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

export interface ShippingEstimate {
  distanceKm: number;
  shippingCost: number;
}

export async function calculateShipping(lat: number, lng: number): Promise<ShippingEstimate> {
  const distanceKm = haversineKm(env.storeLat, env.storeLng, lat, lng);
  const settings = await getSettings();
  const shippingCost =
    distanceKm <= 5 ? settings.shippingCostUpTo5Km : settings.shippingCostOver5Km;
  return { distanceKm, shippingCost };
}
