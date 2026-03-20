import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useBarcodeGun } from '../hooks/useBarcodeGun';
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
        <div style={{ position: 'absolute', right: 0, top: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 160 }}>
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

// ── CreateInvoiceForm ──────────────────────────────────────────────────────
function CreateInvoiceForm({ onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [branchId, setBranchId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showScanner, setShowScanner] = useState(false);

  const [paymentMode, setPaymentMode] = useState('Cash');
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [taxPct, setTaxPct] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.electron.invoke('products:getAll', {}).then(data => setProducts(Array.isArray(data) ? data : []));
    window.electron.invoke('branches:getAll', {}).then(data => setBranches(Array.isArray(data) ? data : []));
    window.electron.invoke('users:getAll', {}).then(data => setSellers(Array.isArray(data) ? data : []));
    window.electron.invoke('customers:getAll', {}).then(data => setCustomers(Array.isArray(data) ? data : []));
  }, []);

  // USB Barcode Gun support — fires when rapid keystrokes detected
  const handleGunScan = useCallback(async (barcode) => {
    const p = await window.electron.invoke('products:findByBarcode', { barcode });
    if (p) { addItem(p); toast.success(`Added: ${p.name}`); }
    else toast.error('Barcode not found: ' + barcode);
  }, []);

  // Disable gun while scanner modal is open (it has its own listener)
  useBarcodeGun(handleGunScan, !showScanner);

  // Webcam / manual scanner callback
  async function handleScanDetected(barcode) {
    setShowScanner(false);
    const p = await window.electron.invoke('products:findByBarcode', { barcode });
    if (p) { addItem(p); toast.success(`Added: ${p.name}`); }
    else toast.error('Product not found for barcode: ' + barcode);
  }

  function onSearch(val) {
    setSearch(val);
    if (!val.trim()) { setSuggestions([]); return; }
    const q = val.toLowerCase();
    setSuggestions(products.filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 8));
  }

  function addItem(product) {
    setItems(prev => {
      const existing = prev.findIndex(i => i.product_id === product.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + 1, amount: (updated[existing].qty + 1) * updated[existing].rate };
        return updated;
      }
      return [...prev, { product_id: product.id, name: product.name, sku: product.sku, qty: 1, rate: product.selling_price || 0, amount: product.selling_price || 0 }];
    });
    setSearch('');
    setSuggestions([]);
  }

  function updateItem(idx, field, val) {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: parseFloat(val) || 0 };
      updated[idx].amount = updated[idx].qty * updated[idx].rate;
      return updated;
    });
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxAmt = subtotal * (taxPct / 100);
  const grandTotal = subtotal + taxAmt - (parseFloat(discount) || 0);

  async function save(status) {
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      const payload = {
        invoice_date: invoiceDate,
        due_date: dueDate,
        branch_id: branchId || null,
        seller_id: sellerId || null,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        items,
        payment_mode: paymentMode,
        split_cash: splitCash ? parseFloat(splitCash) : null,
        split_card: splitCard ? parseFloat(splitCard) : null,
        is_credit_sale: isCreditSale ? 1 : 0,
        tax_pct: taxPct,
        discount: parseFloat(discount) || 0,
        subtotal,
        tax_amount: taxAmt,
        grand_total: grandTotal,
        notes,
        status,
      };
      const result = await window.electron.invoke('invoices:create', payload);
      if (result.success) {
        toast.success(status === 'Draft' ? 'Saved as draft' : 'Invoice created');
        onSaved();
        onClose();
      } else {
        toast.error(result.error || 'Failed to save invoice');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16, background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
        <button className="btn btn-outline" onClick={onClose}>← Back</button>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Create Invoice</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Fill in the details to generate a sales invoice</div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 0 }}>
        {/* Left panel */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto', borderRight: '1px solid #f1f5f9' }}>
          {/* Invoice Details */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Invoice Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">Invoice Date *</label>
                <input type="date" className="form-input" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Branch</label>
                <select className="form-select" value={branchId} onChange={e => setBranchId(e.target.value)}>
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Seller</label>
                <select className="form-select" value={sellerId} onChange={e => setSellerId(e.target.value)}>
                  <option value="">Select Seller</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Customer Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">Customer Name</label>
                <input className="form-input" placeholder="Walk-in Customer" value={customerName} onChange={e => setCustomerName(e.target.value)} list="customer-list" />
                <datalist id="customer-list">
                  {customers.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              <div>
                <label className="form-label">Phone Number</label>
                <input className="form-input" placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Address</label>
                <input className="form-input" placeholder="Customer address (optional)" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Product Search */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Add Products</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input className="form-input" placeholder="Search product by name, SKU or barcode..." value={search} onChange={e => onSearch(e.target.value)} />
                {suggestions.length > 0 && (
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, zIndex: 50, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 260, overflowY: 'auto' }}>
                    {suggestions.map(p => (
                      <div key={p.id} onClick={() => addItem(p)} style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <span>{p.name} <span style={{ color: '#94a3b8', fontSize: 11 }}>{p.sku}</span></span>
                        <span style={{ fontWeight: 600 }}>₹{p.selling_price?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Barcode scan button */}
              <button
                onClick={() => setShowScanner(true)}
                title="Scan barcode (webcam or gun)"
                style={{ padding: '0 14px', background: '#1e293b', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                onMouseLeave={e => e.currentTarget.style.background = '#1e293b'}
              >
                <span>📷</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Scan</span>
              </button>
            </div>
            <div style={{ marginTop: 5, fontSize: 11, color: '#94a3b8' }}>
              💡 USB barcode gun works anytime — just scan and the product is added instantly
            </div>
          </div>

          {/* Barcode Scanner Modal */}
          {showScanner && (
            <BarcodeScanner
              title="Scan Product Barcode"
              onDetected={handleScanDetected}
              onClose={() => setShowScanner(false)}
            />
          )}

          {/* Items Table */}
          <div style={{ marginBottom: 24 }}>
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>#</th><th>Product</th><th>SKU</th><th style={{ width: 80 }}>Qty</th>
                  <th style={{ width: 100 }}>Rate (₹)</th><th style={{ width: 100 }}>Amount (₹)</th><th>Remove</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No items added yet</td></tr>
                )}
                {items.map((item, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{item.name}</td>
                    <td style={{ color: '#64748b' }}>{item.sku}</td>
                    <td><input type="number" min={1} className="form-input" style={{ width: 70, padding: '4px 8px' }} value={item.qty} onChange={e => updateItem(i, 'qty', e.target.value)} /></td>
                    <td><input type="number" min={0} className="form-input" style={{ width: 90, padding: '4px 8px' }} value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} /></td>
                    <td style={{ fontWeight: 600 }}>₹{item.amount.toLocaleString()}</td>
                    <td><button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={3} placeholder="Internal notes or instructions..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: 320, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Payment Mode */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Payment Mode</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Cash', 'Card', 'UPI', 'EFT', 'Split'].map(mode => (
                <button key={mode} onClick={() => setPaymentMode(mode)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                    background: paymentMode === mode ? '#1e293b' : '#fff',
                    color: paymentMode === mode ? '#fff' : '#64748b',
                    borderColor: paymentMode === mode ? '#1e293b' : '#e2e8f0' }}>
                  {mode}
                </button>
              ))}
            </div>
            {paymentMode === 'Split' && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Cash Amount</label>
                  <input type="number" className="form-input" placeholder="0" value={splitCash} onChange={e => setSplitCash(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Card Amount</label>
                  <input type="number" className="form-input" placeholder="0" value={splitCard} onChange={e => setSplitCard(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Credit Sale */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Credit Sale</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Customer pays later</div>
            </div>
            <div onClick={() => setIsCreditSale(v => !v)} style={{ width: 44, height: 24, borderRadius: 12, background: isCreditSale ? '#22c55e' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: 2, left: isCreditSale ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
          </div>

          {/* Tax & Discount */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Adjustments</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Tax (%)</label>
                <input type="number" min={0} max={100} className="form-input" value={taxPct} onChange={e => setTaxPct(parseFloat(e.target.value) || 0)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Discount (₹)</label>
                <input type="number" min={0} className="form-input" value={discount} onChange={e => setDiscount(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Subtotal</span>
                <span>₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Tax ({taxPct}%)</span>
                <span>₹{taxAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Discount</span>
                <span style={{ color: '#ef4444' }}>-₹{(parseFloat(discount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
                <span>Grand Total</span>
                <span>₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {isCreditSale && (
                <div style={{ marginTop: 4, padding: '6px 10px', background: '#fef3c7', borderRadius: 6, fontSize: 11, color: '#92400e', textAlign: 'center' }}>
                  This is a Credit Sale — payment due later
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <button className="btn btn-outline" onClick={() => save('Draft')} disabled={saving}>
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
            <button className="btn btn-black" onClick={() => save(isCreditSale ? 'Credit' : 'Paid')} disabled={saving}>
              {saving ? 'Saving...' : isCreditSale ? 'Save as Credit Sale' : 'Finalize Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ReturnExchangeTab ──────────────────────────────────────────────────────
function ReturnExchangeTab() {
  const [returns, setReturns] = useState([]);
  const [search, setSearch] = useState('');
  const { can } = useAuth();

  useEffect(() => { loadReturns(); }, [search]);

  async function loadReturns() {
    try {
      const data = await window.electron.invoke('returns:getAll', { search });
      setReturns(Array.isArray(data) ? data : []);
    } catch { setReturns([]); }
  }

  return (
    <div>
      <div className="filters-bar">
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13 }}>🔍</span>
          <input className="form-input" style={{ paddingLeft: 32, width: 280 }} placeholder="Search by invoice or customer" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>S.No</th><th>Return No.</th><th>Original Invoice</th><th>Customer</th>
              <th>Type</th><th>Items</th><th>Refund Amount</th><th>Date</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {returns.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>No returns or exchanges found</td></tr>
            )}
            {returns.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{r.return_no}</td>
                <td>{r.invoice_no}</td>
                <td>{r.customer_name}</td>
                <td><span className={`badge ${r.type === 'Return' ? 'badge-orange' : 'badge-blue'}`}>{r.type}</span></td>
                <td>{r.item_count || '-'}</td>
                <td>₹{r.refund_amount?.toLocaleString()}</td>
                <td>{r.return_date}</td>
                <td><span className={`badge ${r.status === 'Completed' ? 'badge-green' : 'badge-grey'}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── BillingInvoice (main) ──────────────────────────────────────────────────
export default function BillingInvoice() {
  const [activeTab, setActiveTab] = useState('Invoices');
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const { can } = useAuth();

  useEffect(() => { loadInvoices(); }, [search, statusFilter]);

  async function loadInvoices() {
    try {
      const data = await window.electron.invoke('invoices:getAll', { status: statusFilter === 'All' ? null : statusFilter, search });
      setInvoices(Array.isArray(data) ? data : []);
    } catch { setInvoices([]); }
  }

  async function markPaid(id) {
    const result = await window.electron.invoke('invoices:updateStatus', { id, status: 'Paid' });
    if (result.success) { toast.success('Marked as paid'); loadInvoices(); }
    else toast.error(result.error || 'Failed');
  }

  async function deleteInvoice(id) {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return;
    const result = await window.electron.invoke('invoices:delete', { id });
    if (result.success) { toast.success('Invoice deleted'); loadInvoices(); }
    else toast.error(result.error || 'Failed');
  }

  const completedInvoices = invoices.filter(inv => inv.status === 'Paid' || inv.status === 'Exchanged');
  const activeInvoices = invoices.filter(inv => inv.status !== 'Paid' && inv.status !== 'Exchanged');

  if (showCreate) {
    return <CreateInvoiceForm onClose={() => setShowCreate(false)} onSaved={loadInvoices} />;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Billing &amp; Invoice</div>
        <div className="page-subtitle">Manage Bills And Create Sales Invoices</div>
      </div>

      <div className="tab-pills">
        {['Invoices', 'Return & Exchange', 'Completed'].map(tab => (
          <div key={tab} className={`tab-pill ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</div>
        ))}
      </div>

      {activeTab === 'Return & Exchange' && <ReturnExchangeTab />}

      {(activeTab === 'Invoices' || activeTab === 'Completed') && (
        <>
          <div className="filters-bar">
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13 }}>🔍</span>
              <input className="form-input" style={{ paddingLeft: 32, width: 280 }} placeholder="Search invoice, customers and amounts" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{ width: 120 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option>All</option><option>Paid</option><option>Draft</option><option>Credit</option>
            </select>
            {activeTab === 'Invoices' && can('billing', 'create') && (
              <button className="btn btn-black filters-bar-right" onClick={() => setShowCreate(true)}>
                + Create Invoice
              </button>
            )}
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>S.No</th><th>Invoice No.</th><th>Customer Name</th><th>Phone No.</th>
                  <th>Items</th><th>Total Amount</th><th>Created By</th><th>Created Date</th>
                  <th>Payment Type</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === 'Completed' ? completedInvoices : activeInvoices).length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>No invoices found</td></tr>
                )}
                {(activeTab === 'Completed' ? completedInvoices : activeInvoices).map((inv, i) => (
                  <tr key={inv.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{inv.invoice_no}</td>
                    <td>{inv.customer_name || 'Walk-in'}</td>
                    <td>{inv.customer_phone || '-'}</td>
                    <td>{inv.item_count || '-'}</td>
                    <td style={{ fontWeight: 600 }}>₹{inv.grand_total?.toLocaleString()}</td>
                    <td>{inv.seller_name || '-'}</td>
                    <td>{inv.invoice_date}</td>
                    <td>{inv.payment_mode}</td>
                    <td>
                      <span className={`badge ${inv.status === 'Paid' ? 'badge-green' : inv.status === 'Draft' ? 'badge-grey' : inv.status === 'Credit' ? 'badge-orange' : 'badge-blue'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <KebabMenu items={[
                        ...(inv.status !== 'Paid' ? [{ label: 'Mark as Paid', action: () => markPaid(inv.id) }] : []),
                        { label: 'Delete Invoice', danger: true, action: () => deleteInvoice(inv.id) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
