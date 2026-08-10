'use client';

import { useState } from 'react';
import { updateItemAction, updateItemValueAction } from '@/app/admin/actions';
import { useRouter } from 'next/navigation';
import CurrencyInput from '../../../admin/CurrencyInput';

const TREND_INFO: Record<string, string> = {
  Rising: 'Demand is outpacing supply, price is trending up.',
  Stable: 'Holding steady, no clear direction either way.',
  Falling: 'Supply is outpacing demand, price is trending down.',
};

const DEMAND_INFO: Record<string, string> = {
  Amazing: 'Extremely sought after, sells almost instantly.',
  High: 'Well sought after, sells quickly.',
  Normal: 'Typical demand, sells at a normal pace.',
  Low: 'Not very sought after, can sit a while.',
  Terrible: 'Very hard to move, little to no interest.',
};

const MIN_REASON_LENGTH = 15;

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

export default function EditItemForm({ item, canEditBasic }: { item: any; canEditBasic: boolean }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'basic' | 'value'>(canEditBasic ? 'basic' : 'value');

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
    if (valueData.reason.trim().length < MIN_REASON_LENGTH) {
      setError(`Give a bit more detail in your reason (at least ${MIN_REASON_LENGTH} characters). This gets posted publicly on the item's Value Changes history, so other traders should be able to see why this happened.`);
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

  const currentValue = item.value || 0;
  const valueDelta = valueData.value - currentValue;
  const currentTrend = item.trend || 'Stable';
  const currentDemand = item.demand || 'Normal';
  const hasChanges = valueData.value !== currentValue || valueData.trend !== currentTrend || valueData.demand !== currentDemand;

  return (
    <div className="card" style={{ padding: '2rem' }}>
      {canEditBasic && (
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
      )}

      {error && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {activeTab === 'basic' && canEditBasic && (
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
          {/* Current state, for reference while deciding on a change */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem',
            padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px',
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Current Value</div>
              <div style={{ fontWeight: 700 }}>{formatNumber(currentValue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>RAP</div>
              <div style={{ fontWeight: 700 }}>{formatNumber(item.rap)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Trend</div>
              <div style={{ fontWeight: 700 }}>{currentTrend}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Demand</div>
              <div style={{ fontWeight: 700 }}>{currentDemand}</div>
            </div>
          </div>

          <div>
            <CurrencyInput
              label="New Value"
              value={valueData.value}
              onChange={(scrips) => setValueData(prev => ({ ...prev, value: scrips }))}
            />
            {valueDelta !== 0 && (
              <div style={{
                marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: 600,
                color: valueDelta > 0 ? 'var(--success-color)' : 'var(--danger-color)',
              }}>
                {valueDelta > 0 ? '▲' : '▼'} {formatNumber(Math.abs(valueDelta))} ({valueDelta > 0 ? '+' : ''}{currentValue > 0 ? ((valueDelta / currentValue) * 100).toFixed(1) : 'n/a'}%) from current value
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
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
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                {TREND_INFO[valueData.trend]}
              </div>
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
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                {DEMAND_INFO[valueData.demand]}
              </div>
            </div>
          </div>

          <div className="input-group">
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Reason for Change (Required)</label>
            <textarea
              value={valueData.reason}
              onChange={e => setValueData(prev => ({ ...prev, reason: e.target.value }))}
              className="input"
              style={{ minHeight: '90px' }}
              placeholder="e.g. Recent resale prices have consistently dropped below current value after the newest limited release drew demand away, dropping to match."
              required
            ></textarea>
            <div style={{
              fontSize: '0.78rem', marginTop: '0.35rem',
              color: valueData.reason.trim().length < MIN_REASON_LENGTH ? 'var(--text-secondary)' : 'var(--success-color)',
            }}>
              {valueData.reason.trim().length}/{MIN_REASON_LENGTH} characters minimum. This is shown publicly on the item&apos;s Value Changes history, so write it for other traders, not just yourself.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving || !hasChanges}
              style={{ flex: 1, backgroundColor: 'var(--success-color)' }}
              title={!hasChanges ? 'Change something before submitting' : undefined}
            >
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
