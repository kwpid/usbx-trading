"use client";

import { useState } from "react";

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export default function ItemDetailsTabs({
  item,
  typeText,
  acronym,
  hoarded,
  trend,
  rapAfterSale,
}: {
  item: any,
  typeText: string,
  acronym: string,
  hoarded: string,
  trend: string,
  rapAfterSale?: number | null,
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'valuation' | 'more_info'>('overview');

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      
      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', borderTopLeftRadius: 'var(--radius)', borderTopRightRadius: 'var(--radius)' }}>
        <div 
          onClick={() => setActiveTab('overview')}
          style={{ padding: '0.75rem', textAlign: 'center', borderBottom: activeTab === 'overview' ? '3px solid var(--text-primary)' : '3px solid transparent', fontWeight: activeTab === 'overview' ? 'bold' : 'normal', color: activeTab === 'overview' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}
        >
          Overview
        </div>
        <div 
          onClick={() => setActiveTab('valuation')}
          style={{ padding: '0.75rem', textAlign: 'center', borderBottom: activeTab === 'valuation' ? '3px solid var(--text-primary)' : '3px solid transparent', fontWeight: activeTab === 'valuation' ? 'bold' : 'normal', color: activeTab === 'valuation' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}
        >
          Valuation
        </div>
        <div 
          onClick={() => setActiveTab('more_info')}
          style={{ padding: '0.75rem', textAlign: 'center', borderBottom: activeTab === 'more_info' ? '3px solid var(--text-primary)' : '3px solid transparent', fontWeight: activeTab === 'more_info' ? 'bold' : 'normal', color: activeTab === 'more_info' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}
        >
          More Info
        </div>
      </div>
      
      {/* Grid Content */}
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Column 1 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Type</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{typeText}</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Copies Sold</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{item.copies_sold !== null && item.copies_sold !== undefined ? formatNumber(item.copies_sold) : '-'}</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Avg Daily Sales</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>0.00</div>
                </div>
              </div>
            </div>

            {/* Column 2 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Acronym</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{acronym}</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>RAP After Sale</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{rapAfterSale != null ? formatNumber(rapAfterSale) : '-'}</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Hoarded</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{hoarded}</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Trend</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{trend}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'valuation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Valuation Method</div>
              <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                This item's value is derived from recent successful sales data and active market demand. 
                Hoarder activity may additionally impact stability.
              </p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Assigned Value</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--rare-color)' }}>{formatNumber(item.value)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Price</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{formatNumber(item.price_best_resale)}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'more_info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Description</div>
              <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                {item.description || "No description available for this item."}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Item ID</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{item.id}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Created</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Unknown'}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
