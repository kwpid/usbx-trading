'use client';

import { useState } from 'react';
import { scrapeItemFromLink, saveScrapedItem } from './actions';
import CurrencyInput from '../CurrencyInput';

type ItemForm = {
  name: string;
  item_image_url: string;
  copies_sold: number;
  available_owners: number;
  rap: number;
  value: number;
  price_best_resale: number;
  is_limited: boolean;
  source_url: string;
};

export default function ScrapeItemForm() {
  const [link, setLink] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<ItemForm | null>(null);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScraping(true);
    setError(null);
    setSuccess(null);
    const result = await scrapeItemFromLink(link);
    setIsScraping(false);
    if (!result.success) {
      setError(result.error || 'Could not scrape that item.');
      return;
    }
    setForm({
      name: result.name || '',
      item_image_url: result.imageUrl || '',
      copies_sold: result.copiesSold ?? 0,
      available_owners: result.uniqueOwners ?? 0,
      rap: result.rapScrips ?? 0,
      // Value is deliberately not auto-filled — it's managed manually via
      // this site's own value-changes tracking, not whatever USBX reports.
      value: 0,
      price_best_resale: result.priceScrips ?? 0,
      is_limited: result.isLimited,
      source_url: result.sourceUrl || link,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!form) return;
    const { name, value, type } = e.target;
    setForm({ ...form, [name]: type === 'number' ? (parseInt(value) || 0) : value });
  };

  const handleSave = async () => {
    if (!form) return;
    setIsSaving(true);
    setError(null);
    const result = await saveScrapedItem(form);
    setIsSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Item saved!');
      setForm(null);
      setLink('');
    }
  };

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <form onSubmit={handleScrape} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <input
          type="url"
          className="input"
          placeholder="https://beta.untitled-sandbox.com/marketplace/547"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          required
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" disabled={isScraping}>
          {isScraping ? 'Scraping...' : 'Scrape'}
        </button>
      </form>

      {error && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success-color)', color: 'var(--success-color)', borderRadius: '6px' }}>
          {success}
        </div>
      )}

      {form && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {form.item_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.item_image_url} alt={form.name} style={{ width: '120px', height: '120px', objectFit: 'contain', gridColumn: '1 / -1' }} />
          )}

          <div className="input-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Item Name</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} className="input" />
          </div>

          <div className="input-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Image URL</label>
            <input type="url" name="item_image_url" value={form.item_image_url} onChange={handleChange} className="input" />
          </div>

          <div className="input-group">
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Copies Sold</label>
            <input type="number" name="copies_sold" value={form.copies_sold} onChange={handleChange} className="input" />
          </div>

          <div className="input-group">
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Unique Owners</label>
            <input type="number" name="available_owners" value={form.available_owners} onChange={handleChange} className="input" />
          </div>

          <CurrencyInput label="Price (lowest resale)" value={form.price_best_resale} onChange={(tokens) => setForm({ ...form, price_best_resale: tokens })} />
          <CurrencyInput label="RAP" value={form.rap} onChange={(tokens) => setForm({ ...form, rap: tokens })} />
          <CurrencyInput label="Value (managed manually)" value={form.value} onChange={(tokens) => setForm({ ...form, value: tokens })} />

          <div className="input-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="is_limited"
              checked={form.is_limited}
              onChange={(e) => setForm({ ...form, is_limited: e.target.checked })}
            />
            <label htmlFor="is_limited" style={{ fontSize: '0.9rem', fontWeight: 500 }}>
              Limited item {form.is_limited ? '(confirmed by USBX)' : '(USBX reports this as non-limited — double-check)'}
            </label>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving}
            style={{ gridColumn: '1 / -1', backgroundColor: 'var(--success-color)' }}
          >
            {isSaving ? 'Saving...' : 'Save Item'}
          </button>
        </div>
      )}
    </div>
  );
}
