import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import RarityBadge from "@/app/components/RarityBadge";

// Add caching for the landing page or revalidate
export const revalidate = 60;

export default async function Home() {
  // Fetch recently updated/uploaded limiteds
  // We handle potential errors gracefully
  let recentItems = [];
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('is_limited', true)
      .order('created_at', { ascending: false })
      .limit(6);
      
    if (!error && data) {
      recentItems = data;
    }
  } catch (err) {
    console.error("Supabase fetch error:", err);
  }

  return (
    <div>
      <section className="hero" style={{ textAlign: 'center', padding: '4rem 0', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem', fontWeight: 800 }}>
          Welcome to <span className="text-gradient">untitled-index</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
          Discover, track, and trade the most exclusive limiteds and wearables in the untitled-sandbox universe.
        </p>
        <Link href="/market" className="btn btn-primary" style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}>
          Explore Marketplace
        </Link>
      </section>

      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ fontSize: '1.8rem' }}>Recently Uploaded Limiteds</h2>
          <Link href="/market" style={{ color: 'var(--accent-color)' }}>View all &rarr;</Link>
        </div>
        
        {recentItems.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>No items found. Run the scraper in the Admin panel to add some!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
            {recentItems.map((item: any) => (
              <Link href={`/items/${item.id}`} key={item.id} className="card" style={{ display: 'block', textDecoration: 'none' }}>
                <div style={{ position: 'relative', height: '200px', backgroundColor: 'var(--bg-tertiary)' }}>
                  {item.is_limited && (
                    <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #EF4444', color: '#EF4444', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '4px', zIndex: 10 }}>
                      LIMITED
                    </div>
                  )}

                  <RarityBadge owners={item.available_owners} />

                  {item.item_image_url ? (
                    <Image src={item.item_image_url} alt={item.name} fill style={{ objectFit: 'contain', padding: '1rem' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>No Image</div>
                  )}
                </div>
                <div style={{ padding: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
