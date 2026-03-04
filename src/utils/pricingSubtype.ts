export type PricingSubtype = 'retail' | 'gros' | 'super_gros' | 'invoice';

interface CatalogProductPricing {
  price_retail?: number | null;
  price_gros?: number | null;
  price_super_gros?: number | null;
  price_invoice?: number | null;
  pricing_unit?: string | null;
  weight_per_box?: number | null;
  pieces_per_box?: number | null;
}

interface InferPricingSubtypeParams {
  itemPaymentType?: string | null;
  unitPrice: number;
  explicitSubtype?: string | null;
  fallbackSubtype?: string | null;
  product?: CatalogProductPricing | null;
  pricingUnit?: string | null;
  weightPerBox?: number | null;
  piecesPerBox?: number | null;
}

const VALID_SUBTYPES: PricingSubtype[] = ['retail', 'gros', 'super_gros', 'invoice'];

const toNumber = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const normalizeSubtype = (value?: string | null): PricingSubtype | null => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (VALID_SUBTYPES.includes(normalized as PricingSubtype)) {
    return normalized as PricingSubtype;
  }
  return null;
};

const getBoxMultiplier = (pricingUnit?: string | null, weightPerBox?: number | null, piecesPerBox?: number | null): number => {
  if (pricingUnit === 'kg') {
    return Math.max(1, toNumber(weightPerBox));
  }
  if (pricingUnit === 'unit') {
    return Math.max(1, toNumber(piecesPerBox));
  }
  return 1;
};

export const inferPricingSubtype = ({
  itemPaymentType,
  unitPrice,
  explicitSubtype,
  fallbackSubtype,
  product,
  pricingUnit,
  weightPerBox,
  piecesPerBox,
}: InferPricingSubtypeParams): PricingSubtype => {
  if (itemPaymentType === 'with_invoice') {
    return 'invoice';
  }

  const explicit = normalizeSubtype(explicitSubtype);
  if (explicit && explicit !== 'invoice') {
    return explicit;
  }

  const fallback = normalizeSubtype(fallbackSubtype);

  const effectivePricingUnit = pricingUnit || product?.pricing_unit || 'box';
  const multiplier = getBoxMultiplier(
    effectivePricingUnit,
    weightPerBox ?? product?.weight_per_box,
    piecesPerBox ?? product?.pieces_per_box,
  );

  const expectedBySubtype: Array<{ subtype: PricingSubtype; price: number }> = [
    { subtype: 'retail' as PricingSubtype, price: toNumber(product?.price_retail) * multiplier },
    { subtype: 'gros' as PricingSubtype, price: toNumber(product?.price_gros) * multiplier },
    { subtype: 'super_gros' as PricingSubtype, price: toNumber(product?.price_super_gros) * multiplier },
  ].filter((entry) => entry.price > 0);

  const tolerance = 0.75;
  const matches = expectedBySubtype
    .filter((entry) => Math.abs(entry.price - toNumber(unitPrice)) <= tolerance)
    .map((entry) => entry.subtype);

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    if (fallback && matches.includes(fallback)) {
      return fallback;
    }
    if (matches.includes('gros')) {
      return 'gros';
    }
    return matches[0];
  }

  if (fallback && fallback !== 'invoice') {
    return fallback;
  }

  return 'gros';
};
