import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: categories } = await supabase.from('Category').select('*');
  console.log('Categories:');
  console.log(categories);

  const { data: subCategories } = await supabase.from('SubCategory').select('*');
  console.log('SubCategories:');
  console.log(subCategories);
}

run().catch(console.error);
