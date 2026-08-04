'use client';

import { useState } from 'react';
import { updateItemAction, updateItemValueAction } from '@/app/admin/actions';
import { useRouter } from 'next/navigation';
import CurrencyInput from '../../../admin/CurrencyInput';

export default function EditItemForm({ item }: { item: any }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'basic' | 'value'>('basic');

  // Basic form state
  const [basicData, setBasicData] = useState({
    name: item.name || '',
    acronym: item.acronym || '',
    item_image_url: item.item_image_url || '',
  });

  // Value change form state
  const [valueData, setValueData] = useState({
    value: item.value || 0,
    trend: item.trend || 'Stable',
    demand: item.demand || 'Normal',
    reason: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBasicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const result = await updateItemAction(item.id, basicData);
    if (result.error) {
      setError(result.error);
      setIsSaving(false);
    } else {
      router.push(`/items/${item.id}`);
      router.refresh();
    }
  };

  const handleValueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valueData.reason.trim()) {
      setError("A reason is required for value changes.");
      return;
    }
    
    setIsSaving(true);
    setError(null);

    const result = await updateItemValueAction(item.id, valueData);
    if (result.error) {
      setError(result.error);
      setIsSaving(false);
    } else {
      // Redirect to the value changes tab to see the change
      router.push(`/item-value-changes/${item.id}`);
      router.refresh();
    }
  };

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
        <button
          className={`btn ${activeTab === 'basic' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveTab('basic'); setError(null); }}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: '-1px' }}
        >
          Basic Details
        </button>
        <button
          className={`btn ${activeTab === 'value' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveTab('value'); setError(null); }}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: '-1px' }}
        >
          Value Changes
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {activeTab === 'basic' && (
        <form onSubmit={handleBasicSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
          <div className="input-group">
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Item Name</label>
            <input 
              type="text" 
              value={basicData.name} 
              onChange={e => setBasicData(prev => ({ ...prev, name: e.target.value }))} 
              className="input" 
              required 
            />
          </div>

          <div className="input-group">
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Acronym</label>
            <input 
              type="text" 
              value={basicData.acronym} 
              onChange={e => setBasicData(prev => ({ ...prev, acronym: e.target.value }))} 
              className="input" 
              placeholder="e.g. SSF" 
              maxLength={10} 
            />
          </div>

          <div className="input-group">
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Image URL</label>
            <input 
              type="url" 
              value={basicData.item_image_url} 
              onChange={e => setBasicData(prev => ({ ...prev, item_image_url: e.target.value }))} 
              className="input" 
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ flex: 1, backgroundColor: 'var(--success-color)' }}>
              {isSaving ? 'Saving...' : 'Save Basic Details'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => router.push(`/items/${item.id}`)} disabled={isSaving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {activeTab === 'value' && (
        <form onSubmit={handleValueSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <CurrencyInput 
                label="New Value (Scrips)" 
                value={valueData.value} 
                onChange={(scrips) => setValueData(prev => ({ ...prev, value: scrips }))} 
              />
            </div>
            
            <div className="input-group">
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Trend</label>
              <select 
                value={valueData.trend} 
                onChange={e => setValueData(prev => ({ ...prev, trend: e.target.value }))}
                className="input"
              >
                <option value="Rising">Rising</option>
                <option value="Stable">Stable</option>
                <option value="Falling">Falling</option>
              </select>
            </div>

            <div className="input-group">
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Demand</label>
              <select 
                value={valueData.demand} 
                onChange={e => setValueData(prev => ({ ...prev, demand: e.target.value }))}
                className="input"
              >
                <option value="Amazing">Amazing</option>
                <option value="High">High</option>
                <option value="Normal">Normal</option>
                <option value="Low">Low</option>
                <option value="Terrible">Terrible</option>
              </select>
            </div>
          </div>

          <div className="input-group">
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Reason for Change (Required)</label>
            <textarea 
              value={valueData.reason} 
              onChange={e => setValueData(prev => ({ ...prev, reason: e.target.value }))} 
              className="input" 
              style={{ minHeight: '80px' }}
              placeholder="Explain why this value, trend, or demand is being updated..."
              required
            ></textarea>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ flex: 1, backgroundColor: 'var(--success-color)' }}>
              {isSaving ? 'Submitting...' : 'Submit Value Change'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => router.push(`/items/${item.id}`)} disabled={isSaving}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
