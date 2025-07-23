ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{"user"}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);

UPDATE users SET 
  first_name = split_part(full_name, ' ', 1),
  last_name = substring(full_name from position(' ' in full_name) + 1)
WHERE full_name IS NOT NULL;

UPDATE users SET roles = 
  CASE 
    WHEN tier = 'enterprise' THEN '{"user", "premium", "enterprise"}'
    WHEN tier = 'pro' THEN '{"user", "premium"}'
    ELSE '{"user"}'
  END;
