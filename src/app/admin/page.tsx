'use client';

import { useState } from 'react';
import Image from 'next/image';
import { fetchPreviewAction, saveItemAction } from './actions';

export default function AdminPage() {
  const [url, setUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setIsFetching(true);
    setError(null);
    setSuccess(null);
    setPreview(null);
    
    const result = await fetchPreviewAction(url);
    if (result.error) {
      setError(result.error);
    } else if (result.preview) {
      setPreview(result.preview);
    }
    
    setIsFetching(false);
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
      setUrl('');
    }
    
    setIsSaving(false);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>Admin Dashboard</h1>
      
      <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Scrape Item from untitled-sandbox</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Paste the URL of an item from beta.untitled-sandbox.com to preview its details before saving it to the database.
        </p>

        <form onSubmit={handleFetch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label htmlFor="url" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Item URL</label>
            <input 
              type="url" 
              id="url" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="input" 
              placeholder="https://beta.untitled-sandbox.com/marketplace/..." 
              required 
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={isFetching || isSaving}
            style={{ marginTop: '0.5rem', opacity: (isFetching || isSaving) ? 0.7 : 1 }}
          >
            {isFetching ? 'Fetching info...' : 'Preview Item'}
          </button>
        </form>

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
            <div style={{ width: '200px', height: '200px', backgroundColor: '#1a1a1e', position: 'relative', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
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
