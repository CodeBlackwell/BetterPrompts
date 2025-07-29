#!/usr/bin/env node

/**
 * Test Data Setup/Teardown Script for Phase 10 Rate Limiting Tests
 * 
 * This script directly manages test API keys in the database when admin API endpoints
 * are not available or returning errors.
 * 
 * Usage:
 *   node test-data-setup.js setup    # Create test API keys
 *   node test-data-setup.js teardown # Remove test API keys
 *   node test-data-setup.js reset    # Reset rate limit counters
 */

const { Client } = require('pg');
const Redis = require('redis');

// Configuration
const config = {
  postgres: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'betterprompts',
    user: process.env.DB_USER || 'betterprompts',
    password: process.env.DB_PASSWORD || 'betterprompts',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
  defaultRateLimit: 1000,
};

// Test API Keys Definition
const testApiKeys = [
  // Core test keys
  { key: 'test-key-user1-primary', user_id: 'test-user-1', rate_limit: 1000 },
  { key: 'test-key-user1-secondary', user_id: 'test-user-1', rate_limit: 1000 },
  { key: 'test-key-user2-primary', user_id: 'test-user-2', rate_limit: 1000 },
  { key: 'test-key-concurrent-1', user_id: 'test-concurrent-1', rate_limit: 1000 },
  { key: 'test-key-concurrent-2', user_id: 'test-concurrent-2', rate_limit: 1000 },
  { key: 'test-key-concurrent-3', user_id: 'test-concurrent-3', rate_limit: 1000 },
  { key: 'test-key-headers', user_id: 'test-headers', rate_limit: 1000 },
  { key: 'test-key-distributed', user_id: 'test-distributed', rate_limit: 1000 },
  
  // Additional test keys
  { key: 'test-key-reset-test', user_id: 'test-reset', rate_limit: 1000 },
  { key: 'test-key-429-header', user_id: 'test-429', rate_limit: 1000 },
  { key: 'test-key-accuracy', user_id: 'test-accuracy', rate_limit: 1000 },
  { key: 'test-key-fixed-window', user_id: 'test-fixed-window', rate_limit: 1000 },
  
  // Header test variations
  { key: 'test-key-headers-429', user_id: 'test-headers', rate_limit: 1000 },
  { key: 'test-key-headers-retry-format', user_id: 'test-headers', rate_limit: 1000 },
  { key: 'test-key-headers-429-ratelimit', user_id: 'test-headers', rate_limit: 1000 },
  { key: 'test-key-headers-consistency', user_id: 'test-headers', rate_limit: 1000 },
  { key: 'test-key-headers-reset-rollover', user_id: 'test-headers', rate_limit: 1000 },
  
  // Distributed test variations
  { key: 'test-key-distributed-shared', user_id: 'test-distributed', rate_limit: 1000 },
  { key: 'test-key-distributed-consistency', user_id: 'test-distributed', rate_limit: 1000 },
  { key: 'test-key-distributed-burst', user_id: 'test-distributed', rate_limit: 1000 },
  { key: 'test-key-distributed-reset-sync', user_id: 'test-distributed', rate_limit: 1000 },
  { key: 'test-key-distributed-clock-skew', user_id: 'test-distributed', rate_limit: 1000 },
  { key: 'test-key-distributed-partial-failure', user_id: 'test-distributed', rate_limit: 1000 },
  { key: 'test-key-distributed-storage-recovery', user_id: 'test-distributed', rate_limit: 1000 },
  { key: 'test-key-distributed-partition', user_id: 'test-distributed', rate_limit: 1000 },
  { key: 'test-key-distributed-cache-invalidation', user_id: 'test-distributed', rate_limit: 1000 },
];

// Add distributed concurrent keys
for (let i = 0; i < 10; i++) {
  testApiKeys.push({
    key: `test-key-distributed-concurrent-${i}`,
    user_id: `test-concurrent-dist-${i}`,
    rate_limit: 1000,
  });
}

// Database setup functions
async function setupDatabase() {
  const client = new Client(config.postgres);
  
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');
    
    // Note: We don't need to create users table since it already exists with UUID type
    // The api_keys table accepts VARCHAR user_id, so we can use string IDs directly
    
    // Create API keys
    let created = 0;
    let skipped = 0;
    
    for (const apiKey of testApiKeys) {
      try {
        await client.query(
          `INSERT INTO api_keys (key, user_id, rate_limit, enabled) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (key) DO UPDATE 
           SET rate_limit = $3, enabled = $4`,
          [apiKey.key, apiKey.user_id, apiKey.rate_limit, true]
        );
        created++;
      } catch (error) {
        console.error(`Failed to create key ${apiKey.key}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`Created/updated ${created} API keys (skipped ${skipped})`);
    
    // Verify the keys were created
    const result = await client.query('SELECT COUNT(*) FROM api_keys WHERE key LIKE $1', ['test-key-%']);
    console.log(`Total test API keys in database: ${result.rows[0].count}`);
    
  } catch (error) {
    console.error('Database setup error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function teardownDatabase() {
  const client = new Client(config.postgres);
  
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');
    
    // Delete test API keys
    const result = await client.query(
      "DELETE FROM api_keys WHERE key LIKE 'test-key-%'"
    );
    
    console.log(`Deleted ${result.rowCount} test API keys`);
    
    // Optionally delete test users
    if (process.env.DELETE_TEST_USERS === 'true') {
      const userResult = await client.query(
        "DELETE FROM users WHERE id LIKE 'test-%'"
      );
      console.log(`Deleted ${userResult.rowCount} test users`);
    }
    
  } catch (error) {
    console.error('Database teardown error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function resetRateLimits() {
  const redisClient = Redis.createClient({
    host: config.redis.host,
    port: config.redis.port,
  });
  
  await new Promise((resolve, reject) => {
    redisClient.on('connect', resolve);
    redisClient.on('error', reject);
  });
  
  console.log('Connected to Redis');
  
  try {
    // Find all rate limit keys
    const keys = await new Promise((resolve, reject) => {
      redisClient.keys('rate_limit:test-key-*', (err, keys) => {
        if (err) reject(err);
        else resolve(keys);
      });
    });
    
    if (keys.length > 0) {
      // Delete all test rate limit keys
      await new Promise((resolve, reject) => {
        redisClient.del(...keys, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      console.log(`Reset ${keys.length} rate limit counters`);
    } else {
      console.log('No rate limit counters to reset');
    }
    
  } catch (error) {
    console.error('Redis reset error:', error);
    throw error;
  } finally {
    redisClient.quit();
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  console.log(`Phase 10 Test Data Helper - Command: ${command || 'help'}`);
  console.log('=====================================\n');
  
  try {
    switch (command) {
      case 'setup':
        await setupDatabase();
        await resetRateLimits();
        console.log('\n✅ Test data setup complete!');
        break;
        
      case 'teardown':
        await teardownDatabase();
        await resetRateLimits();
        console.log('\n✅ Test data teardown complete!');
        break;
        
      case 'reset':
        await resetRateLimits();
        console.log('\n✅ Rate limit counters reset!');
        break;
        
      default:
        console.log('Usage:');
        console.log('  node test-data-setup.js setup    # Create test API keys');
        console.log('  node test-data-setup.js teardown # Remove test API keys');
        console.log('  node test-data-setup.js reset    # Reset rate limit counters');
        console.log('\nEnvironment variables:');
        console.log('  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
        console.log('  REDIS_HOST, REDIS_PORT');
        console.log('  DELETE_TEST_USERS=true  # Also delete test users on teardown');
        process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Operation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}