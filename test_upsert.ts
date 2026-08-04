import 'dotenv/config';
import { supabase } from './src/lib/supabase';
async function run() {
  const { error } = await supabase.from('items').upsert(
    {
      id: 596,
      name: 'Vaporwave',
      description: 'S l o w e d + R e v e r b',
      item_image_url: 'https://assets.unsbx.org/renders/items/596_1784247816743.png',
      is_limited: true,
      copies_sold: 32,
      price_best_resale: 10,
      source_url: `https://beta.untitled-sandbox.com/items/596`,
    },
    { onConflict: 'id' }
  );
  console.log('Error:', error);
}
run();
