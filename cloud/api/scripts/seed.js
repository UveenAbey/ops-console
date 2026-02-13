/**
 * Database Seeding Script
 * 
 * Seeds initial data:
 * - xSPECTRE Internal organization
 * - Admin user
 * 
 * Run: npm run db:seed
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function seedData() {
  console.log('Seeding database...\n');
  
  try {
    // 1. Create xSPECTRE Internal organization
    console.log('Creating xSPECTRE Internal organization...');
    const orgResult = await pool.query(
      `INSERT INTO organizations (name, slug, type)
       VALUES ('xSPECTRE Internal', 'xspectre-internal', 'internal')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );
    const internalOrgId = orgResult.rows[0].id;
    console.log(`✓ xSPECTRE Internal org created (ID: ${internalOrgId})\n`);
    
    // 2. Create default site for internal infrastructure
    console.log('Creating default internal site...');
    await pool.query(
      `INSERT INTO sites (org_id, name, slug, address, city, state, country)
       VALUES ($1, 'Cloud Infrastructure', 'cloud-infra', 'OVH Data Center', 'Sydney', 'NSW', 'Australia')
       ON CONFLICT (org_id, slug) DO NOTHING`,
      [internalOrgId]
    );
    console.log('✓ Default site created\n');
    
    // 3. Create admin user
    console.log('Creating admin user...');
    const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
    await pool.query(
      `INSERT INTO users (email, username, password_hash, first_name, last_name, role, active, email_verified)
       VALUES ('admin@xspectre.internal', 'admin', $1, 'Admin', 'User', 'super_admin', true, true)
       ON CONFLICT (email) DO NOTHING`,
      [passwordHash]
    );
    
    console.log('✓ Admin user created');
    console.log(`  Email: admin@xspectre.internal`);
    console.log(`  Password: ${adminPassword}\n`);
    console.log('  ⚠️  IMPORTANT: Change this password after first login!\n');
    
    // 4. Create some default alert rules
    console.log('Creating default alert rules...');
    
    const defaultRules = [
      {
        name: 'High CPU Usage',
        rule_type: 'cpu_high',
        threshold: 90,
        severity: 'warning',
        description: 'Alert when CPU usage exceeds 90% for 5 minutes'
      },
      {
        name: 'Critical Disk Space',
        rule_type: 'disk_full',
        threshold: 90,
        severity: 'critical',
        description: 'Alert when disk usage exceeds 90%'
      },
      {
        name: 'Device Offline',
        rule_type: 'device_offline',
        threshold: 5,
        severity: 'warning',
        description: 'Alert when device has not sent heartbeat for 5 minutes'
      },
      {
        name: 'Service Down',
        rule_type: 'service_down',
        threshold: 1,
        severity: 'critical',
        description: 'Alert when critical service is not running'
      }
    ];
    
    for (const rule of defaultRules) {
      await pool.query(
        `INSERT INTO alert_rules (name, rule_type, threshold_value, severity, description, enabled)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT DO NOTHING`,
        [rule.name, rule.rule_type, rule.threshold, rule.severity, rule.description]
      );
    }
    
    console.log(`✓ Created ${defaultRules.length} default alert rules\n`);
    
    console.log('Database seeding completed successfully!');
    console.log('\n=== NEXT STEPS ===');
    console.log('1. Start the API server: npm start');
    console.log('2. Login with admin credentials shown above');
    console.log('3. Change admin password in Settings');
    console.log('4. Create organizations and sites');
    console.log('5. Add devices with claim codes\n');
    
  } catch (error) {
    console.error('Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedData();
