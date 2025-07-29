#!/usr/bin/env node

/**
 * Test Data Seeding Script for BetterPrompts E2E Tests
 * 
 * This script creates the required test users and data for Phase 13 journey tests.
 * It can be run against any environment by setting the appropriate environment variables.
 */

const { Client } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const config = {
  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://betterprompts:changeme@localhost:5432/betterprompts',
  },
  users: {
    powerUser: {
      email: process.env.TEST_POWER_USER_EMAIL || 'poweruser@example.com',
      password: process.env.TEST_POWER_USER_PASSWORD || 'PowerUser123!',
      firstName: 'Power',
      lastName: 'User',
      role: 'power_user',
      apiKeyEnabled: true,
    },
    admin: {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@example.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'AdminPassword123!',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      apiKeyEnabled: true,
    },
    testUserCount: parseInt(process.env.TEST_USER_COUNT) || 100,
    batchUserCount: parseInt(process.env.BATCH_USER_COUNT) || 50,
  },
};

// Password hashing function (simplified - use bcrypt in production)
function hashPassword(password) {
  // In a real implementation, use bcrypt or argon2
  // This is a placeholder that creates a consistent hash for testing
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate API key
function generateApiKey() {
  return 'test-api-key-' + crypto.randomBytes(16).toString('hex');
}

// Create database client
async function createDbClient() {
  const client = new Client({
    connectionString: config.database.connectionString,
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    return client;
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    throw error;
  }
}

// Create user in database
async function createUser(client, userData) {
  const { email, password, firstName, lastName, role, apiKeyEnabled } = userData;
  
  try {
    // Check if user already exists
    const checkResult = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (checkResult.rows.length > 0) {
      console.log(`⚠️  User ${email} already exists, skipping...`);
      return checkResult.rows[0].id;
    }
    
    // Create user
    const insertResult = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, created_at, updated_at, email_verified, is_active) 
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), true, true) 
       RETURNING id`,
      [email, hashPassword(password), firstName, lastName, role || 'user']
    );
    
    const userId = insertResult.rows[0].id;
    
    // Create API key if needed
    if (apiKeyEnabled) {
      await client.query(
        `INSERT INTO api_keys (user_id, key, name, created_at, expires_at, is_active) 
         VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '1 year', true)`,
        [userId, generateApiKey(), 'Test API Key']
      );
    }
    
    console.log(`✅ Created user: ${email}`);
    return userId;
  } catch (error) {
    console.error(`❌ Failed to create user ${email}:`, error.message);
    throw error;
  }
}

// Create test users batch
async function createTestUsers(client, prefix, startIndex, count, password) {
  console.log(`\n📝 Creating ${count} ${prefix} users...`);
  
  for (let i = startIndex; i < startIndex + count; i++) {
    const userData = {
      email: `${prefix}${i}@example.com`,
      password: password,
      firstName: prefix.charAt(0).toUpperCase() + prefix.slice(1),
      lastName: `User${i}`,
      role: 'user',
      apiKeyEnabled: false,
    };
    
    try {
      await createUser(client, userData);
    } catch (error) {
      console.error(`Failed to create ${prefix}${i}:`, error.message);
    }
  }
}

// Main seeding function
async function seedTestData() {
  console.log('🌱 Starting test data seeding...\n');
  
  let client;
  
  try {
    // Connect to database
    client = await createDbClient();
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Create power user
    console.log('👤 Creating power user...');
    await createUser(client, config.users.powerUser);
    
    // Create admin user
    console.log('👤 Creating admin user...');
    await createUser(client, config.users.admin);
    
    // Create test users (0-99)
    await createTestUsers(client, 'testuser', 0, config.users.testUserCount, 'TestUser123!');
    
    // Create batch users (200-249)
    await createTestUsers(client, 'batchuser', 200, config.users.batchUserCount, 'BatchUser123!');
    
    // Create sample enhancement history for power user
    console.log('\n📊 Creating sample data for power user...');
    const powerUserResult = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [config.users.powerUser.email]
    );
    
    if (powerUserResult.rows.length > 0) {
      const powerUserId = powerUserResult.rows[0].id;
      
      // Create some enhancement history
      for (let i = 0; i < 10; i++) {
        await client.query(
          `INSERT INTO enhancements (user_id, original_prompt, enhanced_prompt, technique, created_at) 
           VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${i} days')`,
          [
            powerUserId,
            `Test prompt ${i}`,
            `Enhanced test prompt ${i} with advanced techniques`,
            ['chain_of_thought', 'tree_of_thoughts', 'few_shot'][i % 3]
          ]
        );
      }
      console.log('✅ Created enhancement history');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n✅ Test data seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Power User: ${config.users.powerUser.email}`);
    console.log(`- Admin User: ${config.users.admin.email}`);
    console.log(`- Test Users: testuser0@example.com - testuser${config.users.testUserCount - 1}@example.com`);
    console.log(`- Batch Users: batchuser200@example.com - batchuser${200 + config.users.batchUserCount - 1}@example.com`);
    
  } catch (error) {
    // Rollback on error
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    if (client) {
      await client.end();
      console.log('\n👋 Database connection closed');
    }
  }
}

// Check if database is reachable
async function checkDatabase() {
  let client;
  try {
    client = await createDbClient();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database is reachable:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database is not reachable:', error.message);
    console.error('\n💡 Tips:');
    console.error('1. Check if PostgreSQL is running');
    console.error('2. Verify DATABASE_URL in .env file');
    console.error('3. Ensure database exists and user has permissions');
    console.error('4. If using Docker, run: docker-compose up -d postgres');
    return false;
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 BetterPrompts Test Data Seeder\n');
  
  // Check database connection first
  const dbReachable = await checkDatabase();
  if (!dbReachable) {
    process.exit(1);
  }
  
  // Proceed with seeding
  await seedTestData();
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { seedTestData, createUser, createTestUsers };