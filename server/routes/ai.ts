import { GoogleGenAI, Type } from '@google/genai';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { optionalAuth, requireAuth, type AuthedRequest } from '../middleware/auth.ts';

const router = Router();

function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const SQFT_BY_CATEGORY: Record<string, number> = {
  Furniture: 12,
  Electronics: 3.5,
  Documents: 1.5,
  'Household goods': 4.5,
  'Business inventory': 5.0,
  Clothing: 2.5,
  Other: 4.0,
};

router.post('/space-calculator', optionalAuth, async (req, res) => {
  const schema = z.object({
    items: z.array(z.object({
      name: z.string().min(1),
      category: z.string().min(1),
      quantity: z.number().int().min(1).max(200),
      lengthFt: z.number().min(0.2).max(30).optional(),
      widthFt: z.number().min(0.2).max(30).optional(),
      heightFt: z.number().min(0.2).max(15).optional(),
    })).min(1).max(40),
    city: z.string().optional(),
    climateSensitive: z.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Provide at least one item with valid quantity and dimensions.' });
    return;
  }

  let totalSqft = 0;
  let totalCubicFt = 0;
  for (const item of parsed.data.items) {
    if (item.lengthFt && item.widthFt) {
      const footprint = item.lengthFt * item.widthFt * item.quantity;
      const height = item.heightFt || 3;
      totalSqft += footprint * 0.85; // account for smart vertical stacking
      totalCubicFt += footprint * height;
    } else {
      const unitSqft = SQFT_BY_CATEGORY[item.category] ?? 4;
      totalSqft += unitSqft * item.quantity;
      totalCubicFt += unitSqft * 3.5 * item.quantity;
    }
  }

  // Add 20% aisle clearance
  const recommendedSqft = Math.max(12, Math.ceil(totalSqft * 1.2));
  const tier =
    recommendedSqft <= 15
      ? 'Compact Locker (15 sq.ft)'
      : recommendedSqft <= 35
        ? 'Studio Vault (35 sq.ft)'
        : recommendedSqft <= 65
          ? '1BHK Suite (65 sq.ft)'
          : recommendedSqft <= 120
            ? '2BHK Family Bay (120 sq.ft)'
            : 'Business Hub (200 sq.ft)';

  const cityFilter = parsed.data.city && parsed.data.city !== 'All' ? parsed.data.city : null;
  const isUpState = cityFilter?.toLowerCase() === 'uttar pradesh';

  const matchingUnits = db.prepare(`
    SELECT u.id as unitId, u.unit_code as unitCode, u.size_label as sizeLabel, u.area_sqft as areaSqft,
      u.monthly_rate as monthlyRate, u.weekly_rate as weeklyRate, u.daily_rate as dailyRate,
      f.id as facilityId, f.name as facilityName, f.city, f.locality, f.climate_controlled as climateControlled
    FROM units u
    JOIN facilities f ON u.facility_id = f.id
    WHERE u.status = 'available' AND u.area_sqft >= ?
      ${cityFilter ? (isUpState ? "AND (LOWER(f.address) LIKE '%uttar pradesh%' OR LOWER(f.city) IN ('meerut', 'agra', 'noida', 'lucknow'))" : 'AND LOWER(f.city) = LOWER(?)') : ''}
      ${parsed.data.climateSensitive ? 'AND f.climate_controlled = 1' : ''}
    ORDER BY u.area_sqft ASC, u.monthly_rate ASC
    LIMIT 4
  `).all(
    ...[
      Math.min(recommendedSqft, 200),
      ...(cityFilter && !isUpState ? [cityFilter] : []),
    ]
  );

  let packingGuidance = `Based on volumetric calculations (${Math.round(totalCubicFt)} cu.ft total volume with 20% aisle access), a ${tier} gives comfortable vertical stacking without crushing cartons.`;
  let engine: 'gemini' | 'rule_based' = 'rule_based';

  const ai = getGeminiClient();
  if (ai) {
    try {
      const resp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are STOVRA's storage space architect in India. A customer wants to store: ${JSON.stringify(parsed.data.items)}. Calculated net footprint: ${recommendedSqft} sq.ft (${tier}). Provide 2 concise, practical packing & stacking tips in plain English (under 70 words total).`,
      });
      if (resp.text) {
        packingGuidance = resp.text.trim();
        engine = 'gemini';
      }
    } catch {
      // Fallback remains deterministic rule-based calculation
    }
  }

  res.json({
    engine,
    recommendedSqft,
    totalCubicFt: Math.round(totalCubicFt),
    recommendedTier: tier,
    packingGuidance,
    recommendedUnits: matchingUnits,
  });
});

router.post('/inventory-assistant', requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    itemName: z.string().trim().min(2).max(120),
    description: z.string().trim().max(400).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter an item name to analyze.' });
    return;
  }

  const text = `${parsed.data.itemName} ${parsed.data.description || ''}`.toLowerCase();
  let suggestedCategory = 'Other';
  let needsClimateControl = false;
  let packingTip = 'Use double-walled corrugated cartons and label two adjacent sides with QR tags.';

  if (/sofa|table|chair|bed|mattress|wardrobe|desk|cabinet|shelf/.test(text)) {
    suggestedCategory = 'Furniture';
    needsClimateControl = true;
    packingTip = 'Wrap timber edges in corrugated sleeves and cover upholstery with breathable cotton dust sheets rather than tight plastic.';
  } else if (/tv|laptop|monitor|pc|camera|speaker|fridge|ac|microwave|printer|console/.test(text)) {
    suggestedCategory = 'Electronics';
    needsClimateControl = true;
    packingTip = 'Insert silica gel desiccant packets inside anti-static bubble wrap and store upright in a climate-controlled unit.';
  } else if (/file|passport|tax|deed|book|ledger|invoice|certificate|archive/.test(text)) {
    suggestedCategory = 'Documents';
    needsClimateControl = true;
    packingTip = 'Place folders in waterproof polypropylene archival boxes elevated off the floor.';
  } else if (/sku|carton|stock|sample|merchandise|packaging|retail|pallet/.test(text)) {
    suggestedCategory = 'Business inventory';
    packingTip = 'Group cartons by SKU batch on steel racks with QR stickers facing the aisle for rapid scan dispatch.';
  } else if (/coat|saree|suit|jacket|shoe|linen|apparel|clothes|dress/.test(text)) {
    suggestedCategory = 'Clothing';
    needsClimateControl = true;
    packingTip = 'Pack folded garments with cedar blocks inside vacuum-sealed or breathable garment tubs.';
  } else if (/kitchen|utensil|lamp|decor|rug|bicycle|luggage|toy|appliance/.test(text)) {
    suggestedCategory = 'Household goods';
    packingTip = 'Pad fragile glassware individually and place heaviest cartons at the base of each stack.';
  }

  let engine: 'gemini' | 'rule_based' = 'rule_based';
  const ai = getGeminiClient();
  if (ai) {
    try {
      const resp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Classify this storage item for an Indian self-storage platform: "${parsed.data.itemName}" (${parsed.data.description || 'no description'}). Allowed categories: Furniture, Electronics, Documents, Household goods, Business inventory, Clothing, Other.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              needsClimateControl: { type: Type.BOOLEAN },
              packingTip: { type: Type.STRING },
            },
          },
        },
      });
      const data = JSON.parse((resp.text || '{}').trim());
      if (data.category) {
        suggestedCategory = data.category;
        needsClimateControl = Boolean(data.needsClimateControl);
        packingTip = data.packingTip || packingTip;
        engine = 'gemini';
      }
    } catch {
      // Deterministic rule fallback
    }
  }

  res.json({
    engine,
    suggestedCategory,
    needsClimateControl,
    packingTip,
  });
});

router.post('/price-estimator', optionalAuth, (req, res) => {
  const schema = z.object({
    areaSqft: z.number().min(10).max(250),
    city: z.string().optional(),
    climateControlled: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid estimator inputs.' });
    return;
  }

  const cityFilter = parsed.data.city && parsed.data.city !== 'All' ? parsed.data.city : null;
  const isUpState = cityFilter?.toLowerCase() === 'uttar pradesh';

  const units = db.prepare(`
    SELECT u.daily_rate, u.weekly_rate, u.monthly_rate, u.area_sqft, u.size_label, f.city, f.name
    FROM units u
    JOIN facilities f ON u.facility_id = f.id
    WHERE u.area_sqft >= ?
      ${cityFilter ? (isUpState ? "AND (LOWER(f.address) LIKE '%uttar pradesh%' OR LOWER(f.city) IN ('meerut', 'agra', 'noida', 'lucknow'))" : 'AND LOWER(f.city) = LOWER(?)') : ''}
      ${parsed.data.climateControlled ? 'AND f.climate_controlled = 1' : ''}
    ORDER BY u.area_sqft ASC, u.monthly_rate ASC
    LIMIT 1
  `).get(
    ...[
      parsed.data.areaSqft,
      ...(cityFilter && !isUpState ? [cityFilter] : []),
    ]
  ) as Record<string, unknown> | undefined;

  if (!units) {
    res.json({ estimates: null });
    return;
  }

  const daily = Number(units.daily_rate);
  const weekly = Number(units.weekly_rate);
  const monthly = Number(units.monthly_rate);

  res.json({
    matchedUnit: units.size_label,
    facilityName: units.name,
    city: units.city,
    estimates: {
      sevenDays: { base: weekly, gst: Math.round(weekly * 0.18), total: Math.round(weekly * 1.18) },
      oneMonth: { base: monthly, gst: Math.round(monthly * 0.18), total: Math.round(monthly * 1.18) },
      threeMonths: { base: monthly * 3, gst: Math.round(monthly * 3 * 0.18), total: Math.round(monthly * 3 * 1.18) },
      sixMonthsWithPromo: {
        base: monthly * 6,
        discount: Math.min(1500, Math.round(monthly * 6 * 0.15)),
        total: Math.round((monthly * 6 - Math.min(1500, Math.round(monthly * 6 * 0.15))) * 1.18),
      },
      dailyRate: daily,
    },
  });
});

export default router;
