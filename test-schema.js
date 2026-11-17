import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    console.log('Testing missing column error handling...');
    const { data, error } = await supabase.from('profiles').update({ avatar_url: 'test' }).eq('id', 'dummy');
    console.log('Error:', error);
}
test().catch(console.error);
