// Quick script to generate correct bcrypt hash
const bcrypt = require('bcryptjs');

const password = 'password123';
const hash = bcrypt.hashSync(password, 10);

console.log('Password:', password);
console.log('Hash:', hash);

// Test it works
console.log('Verification:', bcrypt.compareSync(password, hash));