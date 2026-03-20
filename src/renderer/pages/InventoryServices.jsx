/**
 * INVENTORY & SERVICES PAGE
 * Stats: Total Items, Low Stock Alert, Stock Value (Cost), Stock Value (Selling)
 * Table: SKU | Product Name | Category | HSN | Purchase Price | Selling Price | Stock | Status | Actions
 */
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import BarcodeScanner from '../components/BarcodeScanner';

// ── KebabMenu ──────────────────────────────────────────────────────────────
function KebabMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn-icon" onClick={() => setOpen(v => !v)}>⋮</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 150 }}>
          {items.map((item, i) => (
            <div key={i} onClick={() => { item.action(); setOpen(false); }}
              style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: item.danger ? '#ef4444' : '#1e293b', borderBottom: i < items.length - 1 ? '1px solid #f1f5f9' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ItemModal (Add / Edit) ─────────────────────────────────────────────────
function ItemModal({ product, categories, onClose, onSaved }) {
  const isEdit = !!product;
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    category_id: product?.category_id || '',
    hsn_code: product?.hsn_code || '',
    unit: product?.unit || 'pcs',
    purchase_price: product?.purchase_price || '',
    selling_price: product?.selling_price || '',
    current_stock: product?.current_stock || '',
    low_stock_threshold: product?.low_stock_threshold || 10,
    description: product?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  function set(field, val) { setForm(prev => ({ ...prev, [field]: val })); }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    if (!form.selling_price) { toast.error('Selling price is required'); return; }
    setSaving(true);
    try {
      const channel = isEdit ? 'products:update' : 'products:create';
      const payload = isEdit ? { id: product.id, ...form } : form;
      const result = await window.electron.invoke(channel, payload);
      if (result.success) {
        toast.success(isEdit ? 'Product updated' : 'Product added');
        onSaved();
        onClose();
      } else {
        toast.error(result.error || 'Failed to save product');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 620, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{isEdit ? 'Edit Product' : 'Add New Item'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Product Name *</label>
            <input className="form-input" placeholder="Enter product name" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="form-label">SKU</label>
            <input className="form-input" placeholder="Auto-generated if blank" value={form.sku} onChange={e => set('sku', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Barcode</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="form-input"
                placeholder="Scan or enter barcode"
                value={form.barcode}
                onChange={e => set('barcode', e.target.value)}
                style={{ flex: 1, fontFamily: 'monospace', letterSpacing: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                title="Scan barcode with webcam or gun"
                style={{ padding: '0 12px', background: '#1e293b', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                onMouseLeave={e => e.currentTarget.style.background = '#1e293b'}
              >
                📷
              </button>
            </div>
            {showScanner && (
              <BarcodeScanner
                title="Scan Product Barcode"
                onDetected={code => { set('barcode', code); setShowScanner(false); toast.success('Barcode captured: ' + code); }}
                onClose={() => setShowScanner(false)}
              />
            )}
          </div>
          <div>
            <label className="form-label">Category</label>
            <select className="form-select" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
              <option value="">Select Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">HSN Code</label>
            <input className="form-input" placeholder="HSN code" value={form.hsn_code} onChange={e => set('hsn_code', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Unit</label>
            <select className="form-select" value={form.unit} onChange={e => set('unit', e.target.value)}>
              {['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'dozen', 'meter'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Purchase Price (₹)</label>
            <input type="number" min={0} className="form-input" placeholder="0.00" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Selling Price (₹) *</label>
            <input type="number" min={0} className="form-input" placeholder="0.00" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Current Stock</label>
            <input type="number" min={0} className="form-input" placeholder="0" value={form.current_stock} onChange={e => set('current_stock', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Low Stock Threshold</label>
            <input type="number" min={0} className="form-input" placeholder="10" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={3} placeholder="Product description (optional)" value={form.description} onChange={e => set('description', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-black" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── InventoryServices (main) ───────────────────────────────────────────────
export default function InventoryServices() {
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const { can } = useAuth();

  useEffect(() => { loadAll(); }, [search, catFilter, statusFilter]);

  function loadAll() {
    window.electron.invoke('products:getAll', { search, category: catFilter === 'All Categories' ? null : catFilter, status: statusFilter === 'All Status' ? null : statusFilter })
      .then(data => setProducts(Array.isArray(data) ? data : []));
    window.electron.invoke('products:getInventoryStats', {})
      .then(data => setStats(data || {}));
    window.electron.invoke('categories:getAll', {})
      .then(data => setCategories(Array.isArray(data) ? data : []));
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    const result = await window.electron.invoke('products:delete', { id });
    if (result.success) { toast.success('Product deleted'); loadAll(); }
    else toast.error(result.error || 'Failed to delete');
  }

  function openAdd() { setEditProduct(null); setShowModal(true); }
  function openEdit(product) { setEditProduct(product); setShowModal(true); }

  const statusBadge = s => s === 'Good' ? 'badge-green' : s === 'Low' ? 'badge-orange' : 'badge-red';
  const stockColor = s => s === 'Good' ? '#16a34a' : s === 'Low' ? '#d97706' : '#dc2626';

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Inventory &amp; Services</div>
        <div className="page-subtitle">Manage Stock And Products</div>
      </div>

      <div className="stat-cards">
        <div className="stat-card blue">
          <div className="stat-card-label">Total Items</div>
          <div className="stat-card-value">{stats.total || 0}</div>
          <div className="stat-card-icon">📦</div>
        </div>
        <div className="stat-card pink">
          <div className="stat-card-label">Low Stock Alert</div>
          <div className="stat-card-value">{stats.lowAlert || 0}</div>
          <div className="stat-card-icon">⚠️</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-card-label">Stock Value (Cost)</div>
          <div className="stat-card-value">₹{(stats.costVal || 0).toLocaleString()}</div>
          <div className="stat-card-icon">💵</div>
        </div>
        <div className="stat-card green">
          <div className="stat-card-label">Stock Value (Selling)</div>
          <div className="stat-card-value">₹{(stats.sellVal || 0).toLocaleString()}</div>
          <div className="stat-card-icon">📈</div>
        </div>
      </div>

      <div className="filters-bar">
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
          <input className="form-input" style={{ paddingLeft: 32, width: 260 }} placeholder="Search by name or SKU" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 160 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option>All Categories</option>
          {categories.map(c => <option key={c.id}>{c.name}</option>)}
        </select>
        <select className="form-select" style={{ width: 130 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option>All Status</option><option>Good</option><option>Low</option><option>Critical</option>
        </select>
        {can('inventory', 'create') && (
          <button className="btn btn-black filters-bar-right" onClick={openAdd}>+ Add Item</button>
        )}
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>S.No</th><th>SKU</th><th>Product Name</th><th>Categories</th>
              <th>HSN</th><th>Purchase Price</th><th>Selling Price</th>
              <th>Stock</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>No products found</td></tr>
            )}
            {products.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.category_name || '-'}</td>
                <td>{p.hsn_code || '-'}</td>
                <td>₹{p.purchase_price?.toLocaleString()}</td>
                <td>₹{p.selling_price?.toLocaleString()}</td>
                <td style={{ color: stockColor(p.status), fontWeight: 600 }}>{p.current_stock}</td>
                <td><span className={`badge ${statusBadge(p.status)}`}>{p.status}</span></td>
                <td>
                  <KebabMenu items={[
                    { label: 'Edit Product', action: () => openEdit(p) },
                    { label: 'Delete Product', danger: true, action: () => handleDelete(p.id) },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ItemModal
          product={editProduct}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}
