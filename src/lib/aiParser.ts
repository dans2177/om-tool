import OpenAI from 'openai';
import type { OMData } from '@/types';

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const SYSTEM_PROMPT = `You are a commercial real estate analyst working for Matthews Real Estate Investment Services.
Analyze the provided Offering Memorandum (OM) text and return a comprehensive JSON object.

IMPORTANT RULES:
- Use null for any field you cannot find or confidently infer.
- Use Title Case for titles, SEO titles, and agent names.
- All monetary values should be numbers (no $ or commas).
- Lot size MUST be in acres only. If given in SF, convert: acres = sf / 43560.
- If price and building_sf_gross are both present, compute price_per_sf = price / building_sf_gross.
- "units" is the number of units for multifamily/apartments, hotel keys for hospitality, storage units for self-storage, or tenant spaces for shopping centers/multi-tenant. null for single-tenant.
- If price exists, set price_display to formatted currency (e.g. "$1,250,000"). Otherwise set price_display to "Contact Broker for Pricing".

Return this exact JSON structure:

{
  "record_type": "<one of: stnl, sc, industrial, mf, leasing, hc, hospitality, self-storage, land, office, mixed-use, manufactured-housing>",
  "title": "<If single-tenant with recognizable brand (Dollar General, Walgreens, etc), use that brand name in Title Case. Else if shopping center/multi-tenant, use center name in Title Case. Else fallback to street number + street name in Title Case.>",
  "saleOrLease": "<for-sale | for-lease | for-auction>",

  "address": {
    "street_number": "<e.g. 123>",
    "street_name": "<e.g. Main Street>",
    "city": "<city name>",
    "state_abbr": "<2-letter state abbreviation, uppercase, e.g. AZ>",
    "state_full": "<full state name>",
    "zip": "<5-digit zip>",
    "full_address": "<complete formatted address: 123 Main Street, Phoenix, AZ 85001>"
  },

  "seo": {
    "seo_title": "<Title Case. Use title if available, else street number + street name.>",
    "slug": "<Format: {record_type}-{title-or-addr-lowercased}-{city}-{state_abbr}. All lowercase, spaces to hyphens, no punctuation except hyphens. IMPORTANT: If saleOrLease is 'for-lease', ALWAYS use 'leasing' as the record_type prefix in the slug regardless of the actual record_type (e.g. 'leasing-warehouse-phoenix-az' not 'industrial-warehouse-phoenix-az'). Examples: stnl-dollar-general-phoenix-az, sc-desert-ridge-marketplace-phoenix-az, leasing-warehouse-phoenix-az>",
    "meta_description": null
  },

  "financials": {
    "price": null,
    "price_display": null,
    "cap_rate_percent": null,
    "noi_annual": null,
    "price_per_sf": null
  },

  "size": {
    "building_sf_gross": null,
    "lot_size_acres": null,
    "units": null
  },

  "classification": {
    "retail_types": ["<from the record_type enum, can be multiple>"],
    "retail_subtypes": ["<any sub-classifications you can identify>"]
  },

  "tenants": ["<tenant names>"],
  "highlights": ["<5-10 key selling points. IMPORTANT: Each highlight MUST follow the format 'Bold Title: longer explanation'. The part before the colon is the short label (2-4 words), the part after is the full detail. Match the Property Highlights / Investment Highlights section of the OM exactly. Example: 'Growing Trade Area: Elon, NC benefits from strong regional connectivity to Burlington and Greensboro, supporting sustained population growth.'>"],
  "loopnet_highlights": ["<Up to 6 highlights for LoopNet. Each MUST be 80-150 characters long — never shorter than 80! Be descriptive and specific with numbers. Example: 'Absolute NNN Lease with 10+ Years Remaining and Annual Rent Increases of 2%', 'Investment-Grade BBB Credit Rated National Tenant with Strong Balance Sheet', 'Prime Hard Corner Location at Signalized Intersection with 45,000+ VPD'>"],
  "term_remaining": "<string. ALWAYS start with the ± symbol followed by a space, then the number of years remaining. e.g. '± 12 Years' or '± 3 Years'. null if not found.>",
  "occupancy_rate_percent": null,
  "year_built": null,
  "year_renovated": null,
  "zoning": null,

  "listing_agents": [
    {
      "name": "<Full name in Title Case>",
      "email": "<email if found>",
      "license_number": "<license # if found>",
      "phone": "<phone if found>",
      "role": "<their title/role as listed, e.g. Vice President, Senior Associate, Advisor, First Vice President, Associate, etc.>"
    }
  ],
  // IMPORTANT: listing_agents MUST be ordered exactly as they appear in the OM under 'Exclusively Listed By' or 'Listed By'. The first name listed in the OM goes first in the array. Do NOT reorder by seniority — keep the OM's original order. The first agent is used in the meta_description.

  "descriptions": {
    "internal_editor_html": "<HTML for WordPress editor. Use <ul><li> bullets from highlights. Each bullet MUST use <strong>Title:</strong> followed by the non-bold description text, matching the OM's property highlights exactly. Example: <ul><li><strong>Growing Trade Area:</strong> Elon, NC benefits from strong regional connectivity...</li></ul>>",
    "public_multi_site_variants": [
      {
        "site": "matthews",
        "value": "<Professional marketing description for Matthews company website. 2-3 paragraphs. Highlight investment opportunity, location, tenant quality.>"
      },
      {
        "site": "third_parties",
        "value": "<SHORT and concise description for third-party listing sites (LoopNet, Crexi, etc). 3-5 sentences MAX. Numbers-focused: price, cap rate, NOI, lease term, SF. No fluff.>"
      }
    ],
    "crazy_header": "<1 punchy headline summarizing the property. No more than 12-16 words. Make it compelling for investors.>"
  },

  "loopnet": {
    "highlights_tags": ["<up to 6 tags, each 50 chars max. Derived from property highlights and specifics. e.g. 'NNN Lease', 'Corporate Guarantee', 'High Traffic Location'>"],
    "formatted_tags_string": "<comma-separated string of the tags above>"
  },

  "leasing_only": {
    "space_title": "<only if record_type is 'leasing', else null>",
    "rate": "<exactly as shown in OM, e.g. '$0.50/SF/Mo NNN'. null if not leasing>",
    "property_type": "<property type for lease listing. null if not leasing>"
  },

  "lease": {
    "lease_type": "<The lease structure type, e.g. NNN, NN, N, Gross, Modified Gross, Ground Lease. Extract whenever tenant/lease info exists, even on for-sale listings (important for NNN investment sales). null if not found.>",
    "lease_price": "<The current rent the tenant pays, exactly as shown in the OM. e.g. '$2,500/mo', '$15.00/SF/Yr NNN', '$180,000/Yr'. This tells the buyer what income the tenant generates. null if not found.>",
    "lease_commencement": "<Lease start/commencement date if found, any format. null if not found.>",
    "lease_expiration": "<Lease expiration date if found, any format. null if not found.>"
  },

  "auction_link": null,

  "audit": {
    "missing_fields": ["<list field names you could NOT find in the OM>"],
    "assumptions": ["<list any assumptions you made, e.g. 'Assumed for-sale based on presence of cap rate'>"],
    "extracted_from": {
      "om_pages_used": ["<which pages contained key data, e.g. 'page 1', 'page 3'>"],
      "sections_used": ["<which sections, e.g. 'Executive Summary', 'Financial Overview', 'Rent Roll'>"]
    }
  }
}

Do NOT include any text outside the JSON object. Output ONLY the JSON.`;

export async function parseOM(rawText: string, notes?: string): Promise<OMData> {
  const userContent = notes
    ? `OM Text:\n${rawText}\n\nUser Notes:\n${notes}`
    : `OM Text:\n${rawText}`;

  const response = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const raw = JSON.parse(content);

  // Ensure all expected sub-objects exist with defaults
  const parsed: OMData = {
    record_type: raw.record_type || 'other' as any,
    title: raw.title || null,
    saleOrLease: raw.saleOrLease || 'for-sale',
    address: {
      street_number: raw.address?.street_number || null,
      street_name: raw.address?.street_name || null,
      city: raw.address?.city || null,
      state_abbr: raw.address?.state_abbr || null,
      state_full: raw.address?.state_full || null,
      zip: raw.address?.zip || null,
      full_address: raw.address?.full_address || null,
    },
    seo: {
      seo_title: raw.seo?.seo_title || null,
      slug: raw.seo?.slug || null,
      meta_description: raw.seo?.meta_description || null,
    },
    financials: {
      price: raw.financials?.price ?? null,
      price_display: raw.financials?.price_display || null,
      cap_rate_percent: raw.financials?.cap_rate_percent ?? null,
      noi_annual: raw.financials?.noi_annual ?? null,
      price_per_sf: raw.financials?.price_per_sf ?? null,
    },
    size: {
      building_sf_gross: raw.size?.building_sf_gross ?? null,
      lot_size_acres: raw.size?.lot_size_acres ?? null,
      units: raw.size?.units ?? null,
    },
    classification: {
      retail_types: raw.classification?.retail_types || [],
      retail_subtypes: raw.classification?.retail_subtypes || [],
    },
    tenants: raw.tenants || [],
    highlights: raw.highlights || [],
    loopnet_highlights: (raw.loopnet_highlights || []).map((h: string) => h?.slice(0, 150)).filter(Boolean).slice(0, 6),
    term_remaining: raw.term_remaining ? (raw.term_remaining.startsWith('±') ? raw.term_remaining : '± ' + raw.term_remaining.replace(/^[+\-_]\s*/, '')) : null,
    occupancy_rate_percent: raw.occupancy_rate_percent ?? null,
    year_built: raw.year_built ?? null,
    year_renovated: raw.year_renovated ?? null,
    zoning: raw.zoning || null,
    listing_agents: (raw.listing_agents || []).map((a: any) => ({
      name: a.name || null,
      email: a.email || null,
      license_number: a.license_number || null,
      phone: a.phone || null,
      role: a.role || null,
    })),
    descriptions: {
      internal_editor_html: raw.descriptions?.internal_editor_html || null,
      public_multi_site_variants: raw.descriptions?.public_multi_site_variants || [
        { site: 'matthews', value: null },
        { site: 'third_parties', value: null },
      ],
      crazy_header: raw.descriptions?.crazy_header || null,
    },
    loopnet: {
      highlights_tags: raw.loopnet?.highlights_tags || [],
      formatted_tags_string: raw.loopnet?.formatted_tags_string || null,
    },
    leasing_only: {
      space_title: raw.leasing_only?.space_title || null,
      rate: raw.leasing_only?.rate || null,
      property_type: raw.leasing_only?.property_type || null,
    },
    lease: {
      lease_type: raw.lease?.lease_type || null,
      lease_price: raw.lease?.lease_price || null,
      lease_commencement: raw.lease?.lease_commencement || null,
      lease_expiration: raw.lease?.lease_expiration || null,
    },
    auction_link: raw.auction_link || null,
    audit: {
      missing_fields: raw.audit?.missing_fields || [],
      assumptions: raw.audit?.assumptions || [],
      extracted_from: {
        om_pages_used: raw.audit?.extracted_from?.om_pages_used || [],
        sections_used: raw.audit?.extracted_from?.sections_used || [],
      },
    },
  };

  // Compute price_per_sf if AI didn't
  if (!parsed.financials.price_per_sf && parsed.financials.price && parsed.size.building_sf_gross) {
    parsed.financials.price_per_sf = Math.round((parsed.financials.price / parsed.size.building_sf_gross) * 100) / 100;
  }

  // Compute price_display if AI didn't
  if (!parsed.financials.price_display) {
    parsed.financials.price_display = parsed.financials.price
      ? `$${parsed.financials.price.toLocaleString()}`
      : 'Contact Broker for Pricing';
  }

  return parsed;
}
