'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { fetchItemFromApiAction, saveItemAction } from './actions';
import CurrencyInput from './CurrencyInput';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'custom' | 'api'>('custom');
  
  // Custom Form State
  const [customData, setCustomData] = useState({
    name: 'Test Item',
    creator: 'Test Creator',
    description: 'This is a test item.',
    item_image_url: 'https://assets.unsbx.org/renders/items/example.png',
    price_best_resale: 1000,
    rap: 950,
    value: 1200,
    available_owners: 100,
    is_limited: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePreviewCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setPreview({ ...customData, premium_copies: 0 });
    setError(null);
    setSuccess(null);
  };

  const handleApiFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPreview(null);
    
    // Placeholder for future API fetch
    const result = await fetchItemFromApiAction('test-id');
    if (result.error) {
      setError(result.error);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    
    setIsSaving(true);
    setError(null);
    
    const result = await saveItemAction(preview);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(result.message || 'Successfully saved!');
      setPreview(null);
    }
    
    setIsSaving(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    if (type === 'checkbox') {
      setCustomData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else if (type === 'number') {
      setCustomData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setCustomData(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem', textAlign: 'center' }}>Admin Dashboard</h1>

      <div style={{ textAlign: 'center', marginBottom: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <Link href="/admin/scrape" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          Add Limited Item (from link)
        </Link>
        <Link href="/admin/sync" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          Sync Marketplace Items
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', justifyContent: 'center' }}>
        <button 
          className="btn"
          onClick={() => setActiveTab('custom')}
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: activeTab === 'custom' ? 'var(--accent-color)' : 'var(--bg-secondary)',
            color: activeTab === 'custom' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Custom Upload (Testing)
        </button>
        <button 
          className="btn"
          onClick={() => setActiveTab('api')}
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: activeTab === 'api' ? 'var(--accent-color)' : 'var(--bg-secondary)',
            color: activeTab === 'api' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          API Upload (Coming Soon)
        </button>
      </div>

      <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        {activeTab === 'api' ? (
          <div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Fetch via API (Coming Soon)</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              We'll add support for directly fetching item data from an API here later.
            </p>
            <form onSubmit={handleApiFetch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Item ID</label>
                <input type="text" className="input" placeholder="Enter Item ID" disabled />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                Fetch Item
              </button>
            </form>
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Custom Item Upload</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Manually enter item details for testing purposes.
            </p>

            <form onSubmit={handlePreviewCustom} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Item Name</label>
                <input type="text" name="name" value={customData.name} onChange={handleChange} className="input" required />
              </div>
              
              <div className="input-group">
                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Creator</label>
                <input type="text" name="creator" value={customData.creator} onChange={handleChange} className="input" />
              </div>

              <div className="input-group">
                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Image URL</label>
                <input type="url" name="item_image_url" value={customData.item_image_url} onChange={handleChange} className="input" />
              </div>

              <div className="input-group">
                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Best Resale Price</label>
                <input type="number" name="price_best_resale" value={customData.price_best_resale} onChange={handleChange} className="input" />
              </div>

              <CurrencyInput label="RAP" value={customData.rap} onChange={(tokens) => setCustomData(prev => ({ ...prev, rap: tokens }))} />
              <CurrencyInput label="Value" value={customData.value} onChange={(tokens) => setCustomData(prev => ({ ...prev, value: tokens }))} />

              <div className="input-group">
                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Available Owners</label>
                <input type="number" name="available_owners" value={customData.available_owners} onChange={handleChange} className="input" />
              </div>

              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Description</label>
                <textarea name="description" value={customData.description} onChange={handleChange} className="input" style={{ minHeight: '80px' }}></textarea>
              </div>

              <div className="input-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" name="is_limited" id="is_limited" checked={customData.is_limited} onChange={handleChange} />
                <label htmlFor="is_limited" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Is Limited</label>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}
              >
                Preview Custom Item
              </button>
            </form>
          </div>
        )}

        {error && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {success && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success-color)', color: 'var(--success-color)', borderRadius: '6px' }}>
            <strong>Success!</strong> {success}
          </div>
        )}
      </div>

      {preview && (
        <div className="card" style={{ padding: '2rem', border: '1px solid var(--accent-color)' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>Preview</h2>
          
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ width: '200px', height: '200px', backgroundColor: 'var(--bg-tertiary)', position: 'relative', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              {preview.item_image_url ? (
                <Image src={preview.item_image_url} alt={preview.name} fill style={{ objectFit: 'contain', padding: '1rem' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>No Image</div>
              )}
            </div>
            
            <div style={{ flex: 1, minWidth: '250px' }}>
              <h3 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>{preview.name}</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>By {preview.creator}</p>
              {preview.description && (
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontStyle: 'italic', fontSize: '0.9rem' }}>
                  "{preview.description}"
                </p>
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Price</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{preview.price_best_resale}</div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>RAP</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{preview.rap}</div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Value</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--rare-color)' }}>{preview.value}</div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Available</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{preview.available_owners}</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                {preview.is_limited && <span style={{ padding: '4px 8px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', border: '1px solid #EF4444', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>LIMITED</span>}
              </div>
              
              <button 
                onClick={handleSave} 
                className="btn btn-primary" 
                disabled={isSaving}
                style={{ width: '100%', fontSize: '1.1rem', padding: '0.75rem', backgroundColor: 'var(--success-color)' }}
              >
                {isSaving ? 'Saving to Database...' : 'Confirm & Upload Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
