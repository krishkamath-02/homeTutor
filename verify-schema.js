import { createClient } from '@supabase/supabase-js';

const url = 'https://csykyhjhzoivwnpcxwbr.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzeWt5aGpoem9pdnducGN4d2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTM1MzcsImV4cCI6MjA4ODI4OTUzN30.GPxd822ck3ifkzUeoTO-ypBtNJFJQ96Vu7UOQjlW7Xc';

const supabase = createClient(url, key);

const tables = [
  'profiles',
  'children',
  'parent_children',
  'parent_invitations',
  'homework',
  'homework_files',
  'tests',
  'questions',
  'test_attempts',
  'student_progress'
];

async function verify() {
  console.log('--- Checking Supabase Schema ---');
  let missing = 0;
  for (const table of tables) {
    const res = await fetch(`${url}/rest/v1/${table}?limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    if (res.status === 200) {
      console.log(`✅ Table '${table}': READY`);
    } else {
      console.log(`❌ Table '${table}': MISSING (HTTP ${res.status})`);
      missing++;
    }
  }

  // Check columns on profiles
  const { error: profileColErr } = await supabase.from('profiles').select('avatar_url, invite_code, email, subscription_tier, daily_test_limit, max_children_allowed').limit(1);
  if (profileColErr) {
    console.log(`⚠️ Profiles subscription columns: ${profileColErr.message}`);
  } else {
    console.log(`✅ Profiles subscription columns: subscription_tier, daily_test_limit, max_children_allowed READY`);
  }

  if (missing === 0 && !profileColErr) {
    console.log('\n🎉 ALL TABLES AND COLUMNS ARE CONFIGURED PROPERLY!');
  } else {
    console.log(`\n⚠️ ${missing} table(s) still need to be migrated.`);
  }
}

verify().catch(console.error);
