// ── Grandview Sender — shared/test-data.js ──────────────────────────────────
// Shared test-mode stub data used by WordPress, Crexi, and LoopNet routers.
'use strict';

window.GVTestData = window.GVTestData || {};

window.GVTestData.TEST_PROP = {
  title:           'AUTOMATION TEST',
  focus_keyphrase: 'Dollar General Net Lease Investment Austin Texas',
  seo_title:       'Dollar General | Austin, TX',
  slug:            'stnl-dollar-general-austin-tx',
  saleOrLease:     'for-sale',
  record_type:     'stnl',
  street:          '1234 Main Street',
  city:            'Austin',
  state_abbr:      'TX',
  state_full:      'Texas',
  zip:             '78701',
  full_address:    '1234 Main Street, Austin, TX 78701',
  lng:             '-97.7431',
  lat:             '30.2672',
  meta_description: 'Matthews Real Estate Investment Services presents a Dollar General NNN investment at 1234 Main Street, Austin, TX. Listed by Hudson DeJean.',
  price:           '1850000',
  cap_rate:        '5.75',
  noi:             '106375',
  price_per_sf:    '203',
  units:           null,
  gross_sqft:      '9100',
  lot_size:        '1.2',
  term_remaining:  '± 12 Years',
  year_built:      '2018',
  occupancy:       '100',
  subtype:         'Dollar Store',
  description_html: '<ul><li><strong>Long-Term NNN Lease:</strong> Dollar General operates on an absolute NNN lease with approximately 12 years of term remaining, providing investors with a truly passive income stream with zero landlord responsibilities.</li><li><strong>Corporate Guarantee:</strong> The lease is backed by Dollar General Corporation (NYSE: DG), an investment-grade rated tenant with a market cap exceeding $40 billion and over 19,000 locations nationwide.</li><li><strong>Built-In Rent Growth:</strong> The lease features 10% rent increases every 5 years, providing inflation protection and long-term income growth for the investor.</li><li><strong>High-Traffic Corridor:</strong> Positioned along a high-traffic retail corridor with over 35,000 vehicles per day, surrounded by established national co-tenants driving consistent consumer foot traffic.</li><li><strong>New Construction:</strong> The 9,100 SF prototype store was constructed in 2018, minimizing near-term capital expenditure requirements and offering a modern building profile.</li></ul>',
  broker: {
    name:           'Hudson DeJean',
    license_number: 'TX-0712345',
    company:        'Matthews Real Estate Investment Services',
    address:        '8390 E. Crescent Pkwy, Suite 300, Greenwood Village, CO 80111',
    phone:          '9492897750',
  },
  listing_agents: [
    {
      name:           'Hudson DeJean',
      email:          'hdejean@matthews.com',
      license_number: 'TX-0712345',
      phone:          '(949) 289-7750',
      role:           'Senior Associate',
    },
  ],
  // Public test assets — real fetchable URLs so image upload step can be exercised
  locked_pdf_url:  'https://pdfobject.com/pdf/sample.pdf',
  final_images: [
    {
      watermarkedUrl: 'https://picsum.photos/seed/matthews1/800/600',
      originalUrl:    'https://picsum.photos/seed/matthews1/800/600',
      filename:       'image-0.jpg',
      hasWatermark:   true,
      hasRepRendering: false,
    },
    {
      watermarkedUrl: 'https://picsum.photos/seed/matthews2/800/600',
      originalUrl:    'https://picsum.photos/seed/matthews2/800/600',
      filename:       'image-1.jpg',
      hasWatermark:   true,
      hasRepRendering: false,
    },
  ],
};
