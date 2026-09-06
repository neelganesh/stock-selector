const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('=== Testing Supabase Connection ===\n');

// Test 1: ANON key without auth
console.log('1. ANON key, no JWT:');
const supabaseAnon = createClient(url, anonKey);
supabaseAnon.from('user_profiles').select('count').then(r => {
  console.log('   Result:', { count: r.count, error: r.error?.message });
  
  // Test 2: Service role
  console.log('\n2. SERVICE_ROLE key:');
  const supabaseService = createClient(url, serviceKey);
  return supabaseService.from('user_profiles').select('count');
}).then(r => {
  console.log('   Result:', { count: r.count, error: r.error?.message });
  
  // Test 3: ANON with user JWT
  console.log('\n3. ANON key + user JWT (user_id: afb9f077-2263-4097-a2de-43a1c177b069):');
  const supabaseUser = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer YOUR_TEST_TOKEN` } }
  });
  return supabaseUser.from('user_profiles').select('*').eq('user_id', 'afb9f077-2263-4097-a2de-43a1c177b069').maybeSingle();
}).then(r => {
  console.log('   Result:', { data: !!r.data, error: r.error?.message });
}).catch(e => console.error('Error:', e.message));
