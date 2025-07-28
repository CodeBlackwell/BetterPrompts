import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Unlocks user accounts by clearing any login attempt locks
 * This is necessary because the API has rate limiting and account locking
 */
export async function unlockUsers(emails: string[] = ['admin@betterprompts.ai']) {
  console.log('🔓 Unlocking user accounts...');
  
  try {
    // Clear Redis cache which might contain lock information
    await execAsync('docker compose exec redis redis-cli FLUSHDB');
    console.log('✅ Redis cache cleared');
    
    // Delete and recreate users to forcibly remove any locks
    for (const email of emails) {
      console.log(`   Deleting and recreating ${email}...`);
      
      // First delete the user
      await execAsync(`docker compose exec -T postgres psql -U betterprompts -d betterprompts -c "DELETE FROM auth.users WHERE email = '${email}';"`);
      
      // Then recreate with a known password hash
      // This hash is for 'password123' (bcrypt $2b$ format)
      const passwordHash = '$2b$10$oBaOyoee0NMFoGWCj9iqEOBtjRNk/8AMehimy1hWw8VJKiSJnEbbq';
      
      // Escape the password hash for SQL
      const escapedHash = passwordHash.replace(/\$/g, '\\$');
      
      const sql = `
        INSERT INTO auth.users (email, username, password_hash, first_name, last_name, roles, tier, is_verified, is_active) 
        VALUES ('${email}', '${email.split('@')[0]}', '${escapedHash}', 
                '${email.includes('admin') ? 'Admin' : 'Test'}', 'User', 
                ARRAY[${email.includes('admin') ? "'admin', 'user'" : "'user'"}], 
                'enterprise', true, true);
      `.replace(/\n/g, ' ');
      
      await execAsync(`docker compose exec -T postgres psql -U betterprompts -d betterprompts -c "${sql}"`);
    }
    
    console.log('✅ User accounts recreated and ready');
    
    // Restart API gateway to clear any in-memory locks
    await execAsync('docker compose restart api-gateway');
    console.log('⏳ Waiting for API to restart...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('❌ Failed to unlock users:', error);
    // Don't throw - tests might still work
  }
}

/**
 * Helper to unlock a single user
 */
export async function unlockUser(email: string) {
  return unlockUsers([email]);
}

/**
 * Clear all authentication-related caches and locks
 */
export async function clearAuthLocks() {
  console.log('🧹 Clearing all authentication locks...');
  
  try {
    // Clear Redis completely
    await execAsync('docker compose exec redis redis-cli FLUSHALL');
    
    // Delete rate limit entries from the database if they exist
    await execAsync(`docker compose exec -T postgres psql -U betterprompts -d betterprompts -c "DELETE FROM auth.login_attempts WHERE email = 'admin@betterprompts.ai' OR ip_address IS NOT NULL;"`);
    
    // Restart API gateway to clear any in-memory state
    await execAsync('docker compose restart api-gateway');
    
    // Wait for API to be ready
    console.log('⏳ Waiting for API to restart...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check API health
    const { stdout } = await execAsync('curl -s http://localhost/api/v1/health');
    if (stdout.includes('healthy')) {
      console.log('✅ API is healthy and locks are cleared');
    } else {
      console.warn('⚠️ API health check returned unexpected response');
    }
    
  } catch (error) {
    console.error('❌ Failed to clear auth locks:', error);
  }
}