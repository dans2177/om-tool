// ── Grandview Sender — wordpress/types.js ───────────────────────────────────
// Type mappings and constants for WordPress ACF fields.
'use strict';

window.WPTypes = window.WPTypes || {};

// ── RecordType → WP "New Property Type" select value ────────────────────────
window.WPTypes.RECORD_TYPE_MAP = {
  stnl:                   'Retail',
  sc:                     'Shopping Centers',
  industrial:             'Industrial',
  mf:                     'Multifamily',
  apartments:             'Apartments',
  leasing:                'Retail',
  hc:                     'Healthcare',
  hospitality:            'Hospitality',
  'self-storage':         'Self Storage',
  land:                   'Land',
  office:                 'Office',
  'manufactured-housing': 'Manufactured Housing',
};

// ── Subtype → WP "New Subtype" select value ─────────────────────────────────
window.WPTypes.SUBTYPE_MAP = {
  'automotive':                     'Automotive',
  'auto':                           'Automotive',
  'car wash':                       'Automotive',
  'carwash':                        'Automotive',
  'auto parts':                     'Automotive',
  'auto dealer':                    'Automotive',
  'dealership':                     'Automotive',
  'oil change':                     'Automotive',
  'tire':                           'Automotive',
  'bank':                           'Bank',
  'convenience store':              'Convenience Stores/Gas Station',
  'convenience stores/gas station': 'Convenience Stores/Gas Station',
  'gas station':                    'Convenience Stores/Gas Station',
  'c-store':                        'Convenience Stores/Gas Station',
  'dollar store':                   'Dollar Store',
  'dollar general':                 'Dollar Store',
  'dollar tree':                    'Dollar Store',
  'drugstore':                      'Drugstore',
  'drug store':                     'Drugstore',
  'pharmacy':                       'Drugstore',
  'cvs':                            'Drugstore',
  'walgreens':                      'Drugstore',
  'education':                      'Education',
  'school':                         'Education',
  'childcare':                      'Education',
  'daycare':                        'Education',
  'grocery store':                  'Grocery Store',
  'grocery':                        'Grocery Store',
  'supermarket':                    'Grocery Store',
  'lifestyle':                      'Lifestyle',
  'lifestyle center':               'Lifestyle',
  'mass merchant':                  'Mass Merchant',
  'big box':                        'Mass Merchant',
  'discount':                       'Mass Merchant',
  'restaurant':                     'Restaurant',
  'qsr':                            'Restaurant',
  'fast food':                      'Restaurant',
  'casual dining':                  'Restaurant',
  'other':                          'Other',
};

// ── Step labels for progress reporting ───────────────────────────────────────
window.WPTypes.STEPS = [
  'Post title',
  'Property description',
  'Focus keyphrase',
  'Sale / Lease type',
  'Yoast SEO title',
  'Yoast meta description',
  'Yoast SEO slug',
  'Property type',
  'Property subtype',
  'Address fields',
  'Geo coordinates',
  'Financial fields',
  'Broker of record',
  'Listing agents',
  'Property document',
  'Images upload',
  'Private Access',
  'Publishing…',
];
