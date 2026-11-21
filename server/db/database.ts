import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'stovra.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      mobile TEXT NOT NULL,
      mobile_verified INTEGER NOT NULL DEFAULT 0,
      otp_code_hash TEXT,
      otp_expires_at TEXT,
      reset_token_hash TEXT,
      reset_expires_at TEXT,
      address TEXT DEFAULT '',
      pincode TEXT DEFAULT '',
      saved_addresses_json TEXT DEFAULT '[]',
      emergency_contact_json TEXT DEFAULT '{"name":"","relation":"","phone":""}',
      notification_prefs_json TEXT DEFAULT '{"booking":true,"payment":true,"expiry":true,"inventory":true,"promotional":false}',
      avatar_url TEXT DEFAULT '',
      referral_code TEXT NOT NULL,
      wallet_balance REAL NOT NULL DEFAULT 500,
      role TEXT NOT NULL DEFAULT 'customer',
      deletion_requested_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS facilities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      city TEXT NOT NULL,
      locality TEXT NOT NULL,
      pincode TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      gallery_json TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 4.8,
      review_count INTEGER NOT NULL DEFAULT 0,
      amenities_json TEXT NOT NULL,
      security_features_json TEXT NOT NULL,
      climate_controlled INTEGER NOT NULL DEFAULT 1,
      operating_hours TEXT NOT NULL,
      base_daily_rate REAL NOT NULL,
      base_weekly_rate REAL NOT NULL,
      base_monthly_rate REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      unit_code TEXT NOT NULL,
      size_label TEXT NOT NULL,
      area_sqft INTEGER NOT NULL,
      dimensions TEXT NOT NULL,
      storage_type TEXT NOT NULL,
      climate_controlled INTEGER NOT NULL DEFAULT 1,
      floor_level TEXT NOT NULL,
      daily_rate REAL NOT NULL,
      weekly_rate REAL NOT NULL,
      monthly_rate REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'available'
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      user_id TEXT,
      user_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      verified_booking INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wishlists (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, facility_id)
    );

    CREATE TABLE IF NOT EXISTS recently_viewed (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      viewed_at TEXT NOT NULL,
      PRIMARY KEY (user_id, facility_id)
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      code TEXT PRIMARY KEY,
      discount_percent INTEGER NOT NULL,
      max_discount REAL NOT NULL,
      min_amount REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      booking_code TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      facility_id TEXT NOT NULL REFERENCES facilities(id),
      unit_id TEXT NOT NULL REFERENCES units(id),
      check_in_date TEXT NOT NULL,
      check_out_date TEXT NOT NULL,
      duration_type TEXT NOT NULL,
      duration_count INTEGER NOT NULL,
      inventory_summary TEXT DEFAULT '',
      item_images_json TEXT DEFAULT '[]',
      subtotal REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      promo_code TEXT DEFAULT '',
      gst_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      booking_status TEXT NOT NULL DEFAULT 'pending',
      qr_token TEXT NOT NULL UNIQUE,
      cancellation_reason TEXT DEFAULT '',
      cancelled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      item_code TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
      facility_id TEXT REFERENCES facilities(id) ON DELETE SET NULL,
      unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      estimated_value REAL NOT NULL DEFAULT 0,
      dimensions TEXT DEFAULT '',
      images_json TEXT DEFAULT '[]',
      qr_token TEXT NOT NULL UNIQUE,
      movement_status TEXT NOT NULL DEFAULT 'in_storage',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_logs (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      location_note TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      payment_id TEXT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      signature_verified INTEGER NOT NULL DEFAULT 0,
      invoice_number TEXT NOT NULL UNIQUE,
      refund_status TEXT NOT NULL DEFAULT 'none',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read_at TEXT,
      link TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      ticket_code TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      screenshot_url TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  seedFacilitiesAndPromos();
}

function seedFacilitiesAndPromos(): void {
  const now = new Date().toISOString();

  const facilities = [
    {
      id: 'fac-blr-indiranagar',
      name: 'STOVRA Indiranagar Vaults',
      slug: 'stovra-indiranagar-vaults',
      city: 'Bengaluru',
      locality: 'Indiranagar 100ft Road',
      pincode: '560038',
      address: '412, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
      lat: 12.9784,
      lng: 77.6408,
      description: 'Flagship climate-controlled urban storage hub in central Indiranagar with biometric turnstiles, individual unit alarms, and dedicated loading dock.',
      image_url: '/src/assets/images/hero_stovra_facility_1795281960311.jpg',
      gallery_json: JSON.stringify([
        '/src/assets/images/hero_stovra_facility_1795281960311.jpg',
        '/src/assets/images/facility_climate_vault_1795281960086.jpg',
        '/src/assets/images/facility_household_unit_1795281960118.jpg',
      ]),
      rating: 4.9,
      review_count: 2,
      amenities_json: JSON.stringify(['Climate Control (20-24°C)', 'Biometric Access', 'Covered Loading Bay', 'Packing Supplies Desk', 'Free Trolleys', 'EV Charging']),
      security_features_json: JSON.stringify(['24/7 HD CCTV', 'Biometric & QR Gate', 'Individual Unit Alarm', 'Smoke & Fire Suppression', 'Pest-Free Sealed Bays']),
      climate_controlled: 1,
      operating_hours: '06:00 AM – 11:00 PM Daily',
      base_daily_rate: 165,
      base_weekly_rate: 990,
      base_monthly_rate: 3499,
    },
    {
      id: 'fac-blr-whitefield',
      name: 'STOVRA Whitefield Tech Hub',
      slug: 'stovra-whitefield-tech-hub',
      city: 'Bengaluru',
      locality: 'Whitefield EPIP Zone',
      pincode: '560066',
      address: 'Plot 28, EPIP Zone Phase II, Whitefield, Bengaluru 560066',
      lat: 12.9698,
      lng: 77.7500,
      description: 'Built for growing families and D2C brands in East Bengaluru. High-bay racks, pallet jacks, and humidity-regulated electronics storage.',
      image_url: '/src/assets/images/facility_business_hub_1795281960170.jpg',
      gallery_json: JSON.stringify([
        '/src/assets/images/facility_business_hub_1795281960170.jpg',
        '/src/assets/images/stovra_qr_inspection_1795281960418.jpg',
        '/src/assets/images/facility_climate_vault_1795281960086.jpg',
      ]),
      rating: 4.8,
      review_count: 2,
      amenities_json: JSON.stringify(['Climate Control (20-24°C)', '24/7 Access', 'Freight Elevator', 'Pallet Jack & Forklift', 'Business Receiving Desk']),
      security_features_json: JSON.stringify(['24/7 HD CCTV', 'QR Entry Verification', 'Motion Sensors', '24h On-site Guard']),
      climate_controlled: 1,
      operating_hours: '24/7 Biometric Access',
      base_daily_rate: 140,
      base_weekly_rate: 850,
      base_monthly_rate: 2999,
    },
    {
      id: 'fac-bom-andheri',
      name: 'STOVRA Andheri East Annex',
      slug: 'stovra-andheri-east-annex',
      city: 'Mumbai',
      locality: 'Andheri East MIDC',
      pincode: '400093',
      address: 'Unit 7, Marol Co-op Industrial Estate, Andheri East, Mumbai 400093',
      lat: 19.1136,
      lng: 72.8697,
      description: 'Monsoon-proof, elevated waterproof storage suites 12 minutes from Mumbai Airport. Engineered for zero dampness during coastal rains.',
      image_url: '/src/assets/images/facility_climate_vault_1795281960086.jpg',
      gallery_json: JSON.stringify([
        '/src/assets/images/facility_climate_vault_1795281960086.jpg',
        '/src/assets/images/hero_stovra_facility_1795281960311.jpg',
        '/src/assets/images/facility_household_unit_1795281960118.jpg',
      ]),
      rating: 4.9,
      review_count: 2,
      amenities_json: JSON.stringify(['Dehumidified Air (<45% RH)', 'Monsoon-Proof Plinth', 'Airport Proximity', 'Drive-up Bay', 'Free Trolleys']),
      security_features_json: JSON.stringify(['24/7 HD CCTV', 'Biometric & QR Gate', 'Flood Sensors', 'Fire Sprinklers']),
      climate_controlled: 1,
      operating_hours: '06:00 AM – 10:30 PM Daily',
      base_daily_rate: 195,
      base_weekly_rate: 1180,
      base_monthly_rate: 4299,
    },
    {
      id: 'fac-bom-lowerparel',
      name: 'STOVRA Lower Parel Reserve',
      slug: 'stovra-lower-parel-reserve',
      city: 'Mumbai',
      locality: 'Lower Parel West',
      pincode: '400013',
      address: 'Tower B Ground, Senapati Bapat Marg, Lower Parel, Mumbai 400013',
      lat: 18.9977,
      lng: 72.8273,
      description: 'Boutique South Mumbai vault lockers for fine wardrobe, art cartons, legal archives, and apartment overflow.',
      image_url: '/src/assets/images/facility_household_unit_1795281960118.jpg',
      gallery_json: JSON.stringify([
        '/src/assets/images/facility_household_unit_1795281960118.jpg',
        '/src/assets/images/facility_climate_vault_1795281960086.jpg',
      ]),
      rating: 4.7,
      review_count: 1,
      amenities_json: JSON.stringify(['Climate Control (20-24°C)', 'Concierge Intake', 'Valet Unloading', 'Archival Shelving']),
      security_features_json: JSON.stringify(['Dual-Factor Biometric', '24/7 Monitoring', 'Individual Smart Locks']),
      climate_controlled: 1,
      operating_hours: '07:00 AM – 10:00 PM Daily',
      base_daily_rate: 220,
      base_weekly_rate: 1350,
      base_monthly_rate: 4899,
    },
    {
      id: 'fac-del-cybercity',
      name: 'STOVRA Gurugram Cyber Vaults',
      slug: 'stovra-gurugram-cyber-vaults',
      city: 'Delhi NCR',
      locality: 'Udyog Vihar Phase IV, Gurugram',
      pincode: '122015',
      address: 'Plot 84, Udyog Vihar Phase IV, Gurugram, Haryana 122015',
      lat: 28.5021,
      lng: 77.0815,
      description: 'High-capacity residential and commercial storage minutes from CyberHub and NH-48 with wide drive-up bays and dust-filtered HVAC.',
      image_url: '/src/assets/images/stovra_qr_inspection_1795281960418.jpg',
      gallery_json: JSON.stringify([
        '/src/assets/images/stovra_qr_inspection_1795281960418.jpg',
        '/src/assets/images/facility_business_hub_1795281960170.jpg',
      ]),
      rating: 4.8,
      review_count: 1,
      amenities_json: JSON.stringify(['HEPA Dust Filtration', 'Wide Truck Bay', '24/7 Access', 'On-site Packing Crew']),
      security_features_json: JSON.stringify(['ANPR Vehicle Gate', '24/7 HD CCTV', 'QR Unit Access', 'Armed Perimeter Security']),
      climate_controlled: 1,
      operating_hours: '24/7 Biometric Access',
      base_daily_rate: 150,
      base_weekly_rate: 890,
      base_monthly_rate: 3199,
    },
    {
      id: 'fac-pnq-hinjewadi',
      name: 'STOVRA Hinjewadi Smart Bay',
      slug: 'stovra-hinjewadi-smart-bay',
      city: 'Pune',
      locality: 'Hinjewadi Phase 1',
      pincode: '411057',
      address: 'Survey 19, Rajiv Gandhi Infotech Park Phase 1, Hinjewadi, Pune 411057',
      lat: 18.5913,
      lng: 73.7389,
      description: 'Flexible short-term and long-term bays designed for relocating tech professionals, students, and Pune startups.',
      image_url: '/src/assets/images/facility_household_unit_1795281960118.jpg',
      gallery_json: JSON.stringify([
        '/src/assets/images/facility_household_unit_1795281960118.jpg',
        '/src/assets/images/hero_stovra_facility_1795281960311.jpg',
      ]),
      rating: 4.7,
      review_count: 1,
      amenities_json: JSON.stringify(['Flexible Daily & Monthly Plans', 'Free Trolleys', 'Ground Floor Drive-Up', 'Student Discounts']),
      security_features_json: JSON.stringify(['24/7 HD CCTV', 'QR Access Pass', 'Fire Alarm System']),
      climate_controlled: 0,
      operating_hours: '06:00 AM – 10:00 PM Daily',
      base_daily_rate: 115,
      base_weekly_rate: 690,
      base_monthly_rate: 2499,
    },
    {
      id: 'fac-up-meerut',
      name: 'STOVRA Meerut Cantt Vaults',
      slug: 'stovra-meerut-cantt-vaults',
      city: 'Meerut',
      locality: 'Delhi Road & Pallavpuram',
      pincode: '250001',
      address: 'Plot 14, NH-58 Delhi-Haridwar Bypass, Near Partapur, Meerut, Uttar Pradesh 250001',
      lat: 28.9845,
      lng: 77.7064,
      description: 'Direct RRTS & Delhi-Meerut Expressway smart storage facility serving Meerut Cantt, Modipuram, and regional sports-goods & apparel exporters.',
      image_url: '/src/assets/images/facility_household_unit_1795281960118.jpg',
      gallery_json: JSON.stringify([
        '/src/assets/images/facility_household_unit_1795281960118.jpg',
        '/src/assets/images/facility_business_hub_1795281960170.jpg',
      ]),
      rating: 4.8,
      review_count: 2,
      amenities_json: JSON.stringify(['Climate Control (20-24°C)', 'Expressway Truck Bay', 'Free Trolleys', 'Packing Supplies Desk']),
      security_features_json: JSON.stringify(['24/7 HD CCTV', 'QR Entry Verification', '24h On-site Guard', 'Smoke & Fire Suppression']),
      climate_controlled: 1,
      operating_hours: '06:00 AM – 10:30 PM Daily',
      base_daily_rate: 105,
      base_weekly_rate: 620,
      base_monthly_rate: 2199,
    },
    {
      id: 'fac-up-agra',
      name: 'STOVRA Agra Taj Expressway Hub',
      slug: 'stovra-agra-taj-expressway-hub',
      city: 'Agra',
      locality: 'Sikandra & Fatehabad Road',
      pincode: '282001',
      address: 'Block C-9, Sikandra Industrial Area, NH-19, Agra, Uttar Pradesh 282001',
      lat: 27.1767,
      lng: 78.0081,
      description: 'Humidity-regulated storage bays built for Agra households, marble handicraft studios, footwear inventory, and Yamuna Expressway commuters.',
      image_url: '/src/assets/images/facility_climate_vault_1795281960086.jpg',
      gallery_json: JSON.stringify([
        '/src/assets/images/facility_climate_vault_1795281960086.jpg',
        '/src/assets/images/stovra_qr_inspection_1795281960418.jpg',
      ]),
      rating: 4.8,
      review_count: 2,
      amenities_json: JSON.stringify(['HEPA Dust Filtration', 'Climate Control (20-24°C)', 'Covered Loading Bay', 'Archival Shelving']),
      security_features_json: JSON.stringify(['24/7 HD CCTV', 'Biometric & QR Gate', 'Individual Unit Alarm', 'Pest-Free Sealed Bays']),
      climate_controlled: 1,
      operating_hours: '06:00 AM – 10:00 PM Daily',
      base_daily_rate: 100,
      base_weekly_rate: 590,
      base_monthly_rate: 2099,
    },
    {
      id: 'fac-up-noida',
      name: 'STOVRA Noida Sector 62 Hub',
      slug: 'stovra-noida-sector-62-hub',
      city: 'Noida',
      locality: 'Sector 62 Electronic City',
      pincode: '201309',
      address: 'C-34, Institutional Area, Sector 62, Noida, Uttar Pradesh 201309',
      lat: 28.6279,
      lng: 77.3649,
      description: 'Modern Noida & Ghaziabad vault complex steps from Sector 62 Metro with 24/7 biometric access for IT professionals and e-commerce sellers.',
      image_url: '/src/assets/images/facility_business_hub_1795281960170.jpg',
      gallery_json: JSON.stringify([
        '/src/assets/images/facility_business_hub_1795281960170.jpg',
        '/src/assets/images/hero_stovra_facility_1795281960311.jpg',
      ]),
      rating: 4.9,
      review_count: 1,
      amenities_json: JSON.stringify(['Climate Control (20-24°C)', '24/7 Access', 'Freight Elevator', 'Business Receiving Desk']),
      security_features_json: JSON.stringify(['ANPR Vehicle Gate', '24/7 HD CCTV', 'Biometric & QR Gate', 'Fire Sprinklers']),
      climate_controlled: 1,
      operating_hours: '24/7 Biometric Access',
      base_daily_rate: 135,
      base_weekly_rate: 810,
      base_monthly_rate: 2899,
    },
    {
      id: 'fac-up-lucknow',
      name: 'STOVRA Lucknow Gomti Nagar Reserve',
      slug: 'stovra-lucknow-gomti-nagar-reserve',
      city: 'Lucknow',
      locality: 'Vibhuti Khand, Gomti Nagar',
      pincode: '226010',
      address: 'Plot 18, Vibhuti Khand, Gomti Nagar, Lucknow, Uttar Pradesh 226010',
      lat: 26.8467,
      lng: 80.9462,
      description: 'Clean, accessible residential and commercial storage suites in East Lucknow with climate control and doorstep pickup coordination.',
      image_url: '/src/assets/images/hero_stovra_facility_1795281960311.jpg',
      gallery_json: JSON.stringify([
        '/src/assets/images/hero_stovra_facility_1795281960311.jpg',
        '/src/assets/images/facility_household_unit_1795281960118.jpg',
      ]),
      rating: 4.8,
      review_count: 1,
      amenities_json: JSON.stringify(['Climate Control (20-24°C)', 'Covered Loading Bay', 'Free Trolleys', 'Packing Supplies Desk']),
      security_features_json: JSON.stringify(['24/7 HD CCTV', 'QR Access Pass', '24h On-site Guard']),
      climate_controlled: 1,
      operating_hours: '06:30 AM – 10:00 PM Daily',
      base_daily_rate: 110,
      base_weekly_rate: 650,
      base_monthly_rate: 2299,
    },
  ];

  const insertFac = db.prepare(`
    INSERT OR IGNORE INTO facilities (
      id, name, slug, city, locality, pincode, address, lat, lng, description,
      image_url, gallery_json, rating, review_count, amenities_json,
      security_features_json, climate_controlled, operating_hours,
      base_daily_rate, base_weekly_rate, base_monthly_rate, created_at
    ) VALUES (
      @id, @name, @slug, @city, @locality, @pincode, @address, @lat, @lng, @description,
      @image_url, @gallery_json, @rating, @review_count, @amenities_json,
      @security_features_json, @climate_controlled, @operating_hours,
      @base_daily_rate, @base_weekly_rate, @base_monthly_rate, @created_at
    )
  `);

  const insertUnit = db.prepare(`
    INSERT OR IGNORE INTO units (
      id, facility_id, unit_code, size_label, area_sqft, dimensions,
      storage_type, climate_controlled, floor_level,
      daily_rate, weekly_rate, monthly_rate, status
    ) VALUES (
      @id, @facility_id, @unit_code, @size_label, @area_sqft, @dimensions,
      @storage_type, @climate_controlled, @floor_level,
      @daily_rate, @weekly_rate, @monthly_rate, @status
    )
  `);

  const unitTemplates = [
    { suffix: 'A01', size_label: 'Compact Locker (15 sq.ft)', area_sqft: 15, dimensions: '3ft x 5ft x 7ft', storage_type: 'Personal & Documents', floor_level: 'Level 1', mult: 0.65 },
    { suffix: 'A02', size_label: 'Studio Vault (35 sq.ft)', area_sqft: 35, dimensions: '5ft x 7ft x 8ft', storage_type: '1RK / Student Move', floor_level: 'Level 1', mult: 1.0 },
    { suffix: 'B01', size_label: '1BHK Suite (65 sq.ft)', area_sqft: 65, dimensions: '6.5ft x 10ft x 8ft', storage_type: 'Household Furniture', floor_level: 'Ground', mult: 1.55 },
    { suffix: 'B02', size_label: '2BHK Family Bay (120 sq.ft)', area_sqft: 120, dimensions: '10ft x 12ft x 9ft', storage_type: 'Full Home Relocation', floor_level: 'Ground', mult: 2.4 },
    { suffix: 'C01', size_label: 'Business Hub (200 sq.ft)', area_sqft: 200, dimensions: '10ft x 20ft x 10ft', storage_type: 'Commercial Inventory', floor_level: 'Ground Dock', mult: 3.6 },
  ];

  const tx = db.transaction(() => {
    for (const f of facilities) {
      insertFac.run({ ...f, created_at: now });
      for (const t of unitTemplates) {
        insertUnit.run({
          id: `${f.id}-${t.suffix.toLowerCase()}`,
          facility_id: f.id,
          unit_code: `${f.city.slice(0, 3).toUpperCase()}-${t.suffix}`,
          size_label: t.size_label,
          area_sqft: t.area_sqft,
          dimensions: t.dimensions,
          storage_type: t.storage_type,
          climate_controlled: f.climate_controlled,
          floor_level: t.floor_level,
          daily_rate: Math.round(f.base_daily_rate * t.mult),
          weekly_rate: Math.round(f.base_weekly_rate * t.mult),
          monthly_rate: Math.round(f.base_monthly_rate * t.mult),
          status: 'available',
        });
      }
    }

    const insertReview = db.prepare(`
      INSERT OR IGNORE INTO reviews (id, facility_id, user_id, user_name, rating, comment, verified_booking, created_at)
      VALUES (?, ?, NULL, ?, ?, ?, 1, ?)
    `);
    insertReview.run('rev-1', 'fac-blr-indiranagar', 'Rohan Kulkarni', 5, 'Stored our 2BHK furniture during apartment renovation in Indiranagar. QR check-in was instant and zero dust after 4 months.', '2026-09-14T10:00:00Z');
    insertReview.run('rev-2', 'fac-blr-indiranagar', 'Meera Nair', 5, 'Cleanest storage corridors I have seen in Bengaluru. Humidity stayed steady for our studio monitors.', '2026-10-02T15:30:00Z');
    insertReview.run('rev-3', 'fac-blr-whitefield', 'Siddharth Rao', 5, 'We keep 40+ D2C packaging cartons here. Scanning box QR codes makes dispatch effortless.', '2026-09-22T11:20:00Z');
    insertReview.run('rev-4', 'fac-blr-whitefield', 'Ananya Deshmukh', 4, 'Freight lift and trolley access saved our move time by half.', '2026-10-18T09:10:00Z');
    insertReview.run('rev-5', 'fac-bom-andheri', 'Vikramaditya Joshi', 5, 'Survived heavy Mumbai rains with zero moisture on wooden heirlooms. Worth every rupee.', '2026-08-29T16:45:00Z');
    insertReview.run('rev-6', 'fac-bom-andheri', 'Kavita Shah', 5, 'Super close to Terminal 2. Picked up two winter trunks straight from the airport.', '2026-10-11T14:00:00Z');
    insertReview.run('rev-7', 'fac-bom-lowerparel', 'Arjun Mehta', 5, 'Great archival shelving and helpful intake desk.', '2026-09-19T12:15:00Z');
    insertReview.run('rev-8', 'fac-del-cybercity', 'Neha Kapoor', 5, 'Booked online in 3 minutes and moved in the same evening. Transparent GST invoice.', '2026-10-05T17:40:00Z');
    insertReview.run('rev-9', 'fac-pnq-hinjewadi', 'Pratik Patil', 5, 'Stored bike gear and books for 2 months between leases in Hinjewadi. Smooth refund of advance.', '2026-10-21T13:05:00Z');
    insertReview.run('rev-10', 'fac-up-meerut', 'Ankit Chaudhary', 5, 'Right off the Delhi-Meerut Expressway. Stored our household goods cleanly during home renovation in Shastri Nagar.', '2026-10-28T11:15:00Z');
    insertReview.run('rev-11', 'fac-up-meerut', 'Pooja Tyagi', 5, 'Excellent climate control and QR box labels for our sports equipment inventory.', '2026-11-04T14:40:00Z');
    insertReview.run('rev-12', 'fac-up-agra', 'Devendra Bansal', 5, 'Zero dust inside our craft carton bay in Sikandra. Very smooth UPI booking.', '2026-10-25T16:20:00Z');
    insertReview.run('rev-13', 'fac-up-agra', 'Shalini Agarwal', 5, 'Safe and well-lit facility near NH-19 with polite intake staff.', '2026-11-02T10:50:00Z');
    insertReview.run('rev-14', 'fac-up-noida', 'Gaurav Verma', 5, '24/7 biometric access near Sector 62 Metro makes restocking our D2C cartons super convenient.', '2026-11-06T18:10:00Z');
    insertReview.run('rev-15', 'fac-up-lucknow', 'Ritu Mishra', 5, 'Spotless Gomti Nagar storage unit with clear GST billing and responsive support.', '2026-11-08T12:30:00Z');

    const insertPromo = db.prepare(`
      INSERT OR IGNORE INTO promo_codes (code, discount_percent, max_discount, min_amount, active, description)
      VALUES (?, ?, ?, ?, 1, ?)
    `);
    insertPromo.run('STOVRA15', 15, 1500, 1500, '15% off up to ₹1,500 on bookings above ₹1,500');
    insertPromo.run('FIRST20', 20, 2000, 2000, '20% off up to ₹2,000 for new storage bookings');
    insertPromo.run('MONSOON10', 10, 1000, 1000, '10% off on climate-controlled vaults');
  });

  tx();
}
