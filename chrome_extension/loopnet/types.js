// ── Grandview Sender — loopnet/types.js ──────────────────────────────────────
'use strict';

window.LoopNetTypes = window.LoopNetTypes || {};

// ── Step labels (in order of the LoopNet listing flow) ────────────────────────
window.LoopNetTypes.LOOPNET_STEPS = [
  'Add Listing',        // 0 — land on listingmanager.costar.com/my-listings, click "Add a Listing"
  'Property Category',  // 1 — For Sale / For Lease, then property type + sub-type dropdowns
  'Map & Address',      // 2 — type address into map search, confirm pin
  'Property Details',   // 3 — sqft, year built, lot size, NOI, lease dates
  'Description',        // 4 — property description textarea
  'Media Upload',       // 5 — image / document uploads
  'Review & Submit',    // 6 — final checkover before submitting
];

// ── LoopNet property-type labels (used in the Category step dropdown) ─────────
// Keys match Matthews/Grandview record_type values.
window.LoopNetTypes.PROPERTY_TYPE_MAP = {
  stnl:                   'Retail',
  sc:                     'Retail',
  industrial:             'Industrial',
  mf:                     'Multifamily',
  leasing:                'Retail',
  hc:                     'Special Purpose',
  hospitality:            'Hospitality',
  'self-storage':         'Self-Storage',
  land:                   'Land',
  office:                 'Office',
  'mixed-use':            'Mixed Use',
  'manufactured-housing': 'Mobile Home Park',
};

// ── LoopNet sub-type labels ───────────────────────────────────────────────────
// These are the LoopNet-specific sub-category labels shown in the type dropdown.
window.LoopNetTypes.SUBTYPE_MAP = {
  // Retail
  'dollar store':                     'Single Tenant Retail',
  'dollar general':                   'Single Tenant Retail',
  'dollar tree':                      'Single Tenant Retail',
  'drugstore':                        'Drug Store',
  'drug store':                       'Drug Store',
  'pharmacy':                         'Drug Store',
  'cvs':                              'Drug Store',
  'walgreens':                        'Drug Store',
  'grocery store':                    'Grocery/Supermarket',
  'grocery':                          'Grocery/Supermarket',
  'supermarket':                      'Grocery/Supermarket',
  'convenience store':                'Convenience Store/Gas Station',
  'convenience stores/gas station':   'Convenience Store/Gas Station',
  'gas station':                      'Convenience Store/Gas Station',
  'c-store':                          'Convenience Store/Gas Station',
  'bank':                             'Bank',
  'restaurant':                       'Restaurant',
  'qsr':                              'Restaurant/Fast Food',
  'fast food':                        'Restaurant/Fast Food',
  'bar':                              'Restaurant',
  'automotive':                       'Auto Dealership',
  'auto':                             'Auto Dealership',
  'car wash':                         'Car Wash',
  'carwash':                          'Car Wash',
  'education':                        'Day Care/Nursery/Preschool',
  'school':                           'Day Care/Nursery/Preschool',
  'childcare':                        'Day Care/Nursery/Preschool',
  'daycare':                          'Day Care/Nursery/Preschool',
  'lifestyle center':                 'Strip Center',
  'shopping center':                  'Strip Center',
  'storefront':                       'Single Tenant Retail',
  'big box':                          'Freestanding',
  // Industrial
  'distribution':                     'Distribution',
  'flex':                             'Flex Space',
  'warehouse':                        'Warehouse',
  'manufacturing':                    'Manufacturing',
  'cold storage':                     'Refrigeration/Cold Storage',
  'refrigerated':                     'Refrigeration/Cold Storage',
  // Office
  'traditional office':               'General Office',
  'medical office':                   'Medical Office',
  'executive office':                 'Executive Suite',
  // Hospitality
  'hotel':                            'Hotel',
  'motel':                            'Motel',
};

// ── Helpers for resolving types ───────────────────────────────────────────────

/**
 * Given a raw record_type / subtype string from Grandview,
 * returns the best LoopNet property-type label.
 */
window.LoopNetTypes.resolvePropertyType = function resolvePropertyType(prop) {
  const rt = (prop.record_type || '').toLowerCase().trim();
  return window.LoopNetTypes.PROPERTY_TYPE_MAP[rt] || 'Retail';
};

/**
 * Given a raw subtype / tenants_info string from Grandview,
 * returns the best LoopNet sub-type label.
 * Falls back to resolvePropertyType if no specific sub-type found.
 */
window.LoopNetTypes.resolveSubType = function resolveSubType(prop) {
  const candidates = [
    prop.subtype,
    prop.tenants_info,
    prop.record_type,
  ].filter(Boolean).map((s) => s.toLowerCase().trim());

  for (const candidate of candidates) {
    for (const [key, val] of Object.entries(window.LoopNetTypes.SUBTYPE_MAP)) {
      if (candidate.includes(key)) return val;
    }
  }

  return window.LoopNetTypes.resolvePropertyType(prop);
};
