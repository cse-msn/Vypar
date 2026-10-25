import { ShippingZone, type ShippingZoneDoc, type IShippingRate } from '../models/ShippingZone';
import { ApiError } from '../utils/ApiError';
import { round2 } from '../utils/money';

export interface ShippingDestination {
  state?: string;
  pincode?: string;
}

export interface ShippingOption {
  /** Composite id `${zoneId}:${rateId}` the client echoes back when placing the order. */
  id: string;
  label: string;
  /** Effective price after applying any free-above threshold for this subtotal. */
  price: number;
  eta?: string;
}

const norm = (s?: string) => (s ?? '').trim().toLowerCase();

/** Does a zone serve this destination? */
function zoneMatches(zone: ShippingZoneDoc, dest: ShippingDestination): boolean {
  if (zone.matchType === 'all') return true;
  if (zone.matchType === 'states') return zone.states.some((s) => norm(s) === norm(dest.state));
  if (zone.matchType === 'pincodes') {
    const pin = (dest.pincode ?? '').trim();
    return !!pin && zone.pincodePrefixes.some((p) => pin.startsWith(p.trim()));
  }
  return false;
}

function effectivePrice(rate: IShippingRate, subtotal: number): number {
  if (rate.freeAbove > 0 && subtotal >= rate.freeAbove) return 0;
  return round2(rate.price);
}

/** The first active zone (by priority) that serves this destination, or null. */
async function findZone(dest: ShippingDestination): Promise<ShippingZoneDoc | null> {
  const zones = await ShippingZone.find({ active: true }).sort({ priority: 1, createdAt: 1 });
  return zones.find((z) => zoneMatches(z, dest)) ?? null;
}

/**
 * Shipping options for a destination + subtotal. If no zones are configured at all, shipping is free
 * (a sensible default for a shop that hasn't set rates yet). If zones exist but none serve the address,
 * returns an empty list — the area isn't serviceable.
 */
export async function quoteShipping(dest: ShippingDestination, subtotal: number): Promise<ShippingOption[]> {
  const anyZone = await ShippingZone.exists({ active: true });
  if (!anyZone) return [{ id: 'default:free', label: 'Standard', price: 0 }];

  const zone = await findZone(dest);
  if (!zone) return [];
  return zone.rates.map((r) => ({
    id: `${zone.id}:${r._id}`,
    label: r.label,
    price: effectivePrice(r, subtotal),
    eta: r.eta,
  }));
}

/**
 * Resolve the chosen shipping option id into a trusted fee — recomputed on the server from the zone +
 * subtotal, never from a client-supplied price. Returns the fee and the method label stored on the order.
 */
export async function resolveShippingFee(
  shippingRateId: string | undefined,
  dest: ShippingDestination,
  subtotal: number,
): Promise<{ fee: number; method?: string }> {
  const anyZone = await ShippingZone.exists({ active: true });
  if (!anyZone) return { fee: 0, method: 'Standard' };

  if (!shippingRateId || shippingRateId === 'default:free') {
    // Zones exist but the client sent none — fall back to the cheapest serviceable option.
    const options = await quoteShipping(dest, subtotal);
    if (!options.length) throw ApiError.badRequest("Sorry, we don't deliver to this address yet.");
    const cheapest = options.reduce((a, b) => (b.price < a.price ? b : a));
    return { fee: cheapest.price, method: cheapest.label };
  }

  const [zoneId, rateId] = shippingRateId.split(':');
  const zone = await ShippingZone.findOne({ _id: zoneId, active: true });
  if (!zone || !zoneMatches(zone, dest)) throw ApiError.badRequest("Sorry, we don't deliver to this address yet.");
  const rate = zone.rates.id(rateId);
  if (!rate) throw ApiError.badRequest('That shipping option is no longer available');
  return { fee: effectivePrice(rate, subtotal), method: rate.label };
}
