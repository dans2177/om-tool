// ── Grandview Sender — crexi/types.js ─────────────────────────────────────────
// Type mappings, constants, and Crexi-specific data structures.
// Values verified against the live Crexi "Add Listing" form DOM.
'use strict';

window.CrexiTypes = window.CrexiTypes || {};

// ── RecordType → Crexi property type checkbox label ──────────────────────────
// These MUST match the .mdc-label text inside the cui-dropdown-list exactly.
// Crexi property types (from the cui-select[formcontrolname="types"] dropdown):
//   Retail, Multifamily, Office, Industrial, Hospitality, Mixed Use, Land,
//   Self Storage, Mobile Home Park, Senior Living, Special Purpose,
//   Note/Loan, Business for Sale
window.CrexiTypes.PROPERTY_TYPE_MAP = {
  stnl:                   'Retail',
  sc:                     'Retail',           // Shopping Centers → Retail on Crexi
  industrial:             'Industrial',
  mf:                     'Multifamily',
  leasing:                'Retail',
  hc:                     'Special Purpose',  // Healthcare → Special Purpose on Crexi
  hospitality:            'Hospitality',
  'self-storage':         'Self Storage',
  land:                   'Land',
  office:                 'Office',
  'mixed-use':            'Mixed Use',
  'manufactured-housing': 'Mobile Home Park',
};

// ── Our subtype → Crexi ng-option-label value ────────────────────────────────
// These MUST match the .ng-option-label text in the ng-dropdown-panel exactly.
//
// Retail subtypes:
//   Bank, Convenience Store, Day Care/Nursery, QSR/Fast Food, Gas Station,
//   Grocery Store, Pharmacy/Drug, Restaurant, Bar, Storefront, Shopping Center, Auto Shop
//
// Industrial subtypes:
//   Distribution, Flex, Warehouse, R&D, Manufacturing, Refrigerated/Cold Storage
//
// Office subtypes:
//   Traditional Office, Executive Office, Medical Office, Creative Office
//
// Hospitality subtypes:
//   Hotel, Motel, Casino
//
// Land subtypes:
//   Agricultural, Residential, Commercial, Industrial, Islands, Farm, Ranch,
//   Timber, Hunting/Recreational
//
// Special Purpose subtypes:
//   Telecom/Data Center, Sports/Entertainment, Marina, Golf Course, School,
//   Religious/Church, Garage/Parking, Car Wash, Airport
//
// Business for Sale subtypes:
//   Business Only, Business and Building
window.CrexiTypes.SUBTYPE_MAP = {
  // Retail
  'dollar store':                     'Storefront',
  'dollar general':                   'Storefront',
  'dollar tree':                      'Storefront',
  'drugstore':                        'Pharmacy/Drug',
  'drug store':                       'Pharmacy/Drug',
  'pharmacy':                         'Pharmacy/Drug',
  'cvs':                              'Pharmacy/Drug',
  'walgreens':                        'Pharmacy/Drug',
  'grocery store':                    'Grocery Store',
  'grocery':                          'Grocery Store',
  'supermarket':                      'Grocery Store',
  'convenience store':                'Convenience Store',
  'convenience stores/gas station':   'Gas Station',
  'gas station':                      'Gas Station',
  'c-store':                          'Convenience Store',
  'bank':                             'Bank',
  'restaurant':                       'Restaurant',
  'qsr':                              'QSR/Fast Food',
  'fast food':                        'QSR/Fast Food',
  'casual dining':                    'Restaurant',
  'bar':                              'Bar',
  'automotive':                       'Auto Shop',
  'auto':                             'Auto Shop',
  'car wash':                         'Car Wash',
  'carwash':                          'Car Wash',
  'education':                        'School',
  'school':                           'School',
  'childcare':                        'Day Care/Nursery',
  'daycare':                          'Day Care/Nursery',
  'mass merchant':                    'Storefront',
  'big box':                          'Storefront',
  'lifestyle':                        'Shopping Center',
  'lifestyle center':                 'Shopping Center',
  'shopping center':                  'Shopping Center',
  'storefront':                       'Storefront',
  'other':                            'Storefront',

  // Industrial
  'distribution':                     'Distribution',
  'flex':                             'Flex',
  'warehouse':                        'Warehouse',
  'r&d':                              'R&D',
  'manufacturing':                    'Manufacturing',
  'cold storage':                     'Refrigerated/Cold Storage',
  'refrigerated':                     'Refrigerated/Cold Storage',

  // Office
  'traditional office':               'Traditional Office',
  'executive office':                 'Executive Office',
  'medical office':                   'Medical Office',
  'creative office':                  'Creative Office',

  // Hospitality
  'hotel':                            'Hotel',
  'motel':                            'Motel',
  'casino':                           'Casino',
};

// ── Step labels for progress reporting ───────────────────────────────────────
window.CrexiTypes.STEPS = [
  'Choose Sale / Lease',
  'Property Type',
  'Address',
  'Financials',
  'Property Details',
  'Description',
  'Media Upload',
  'Offering Memorandum',
  'Review & Submit',
];
