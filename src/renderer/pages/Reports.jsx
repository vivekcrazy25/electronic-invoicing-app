/**
 * REPORTS PAGE
 * Claude Code: Build per SKILL.md Section 21 (Screens 21-28)
 * 7 sub-reports: Sales | Purchase | Stock | Customer Outstanding | Vendor Outstanding | P&L | Balance Sheet
 */
import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

const TABS = ['Sales Report','Purchase Report','Stock Report','Customer Outstanding','Vendor Outstanding','Profit & Loss','Balance Sheet'];

const today = new Date().toISOString().split('T')[0];
const yearStart = `${new Date().getFullYear()}-01-01`;

export default function Reports() {
  const [activeTab, setActiveTab] = useState('Sales Report');
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({});
  const [dateFrom, setDateFrom] = useState(yearStart);
  const [dateTo, setDateTo] = useState(today);

  useEffect(() => { loadReport(); }, [activeTab, dateFrom, dateTo]);

  async function loadReport() {
    setData([]);
    switch (activeTab) {
      case 'Sales Report': {
        const rows = await window.electron.invoke('reports:sales', { from: dateFrom, to: dateTo });
        setData(rows);
        const totalSales = rows.reduce((s,r) => s + r.amount, 0);
        const totalProfit = rows.reduce((s,r) => s + (r.profit||0), 0);
        setStats({ card1: { label:'Total Sales', val: `$${totalSales.toLocaleString()}` }, card2: { label:'Total Invoices', val: new Set(rows.map(r=>r.bill_no)).size }, card3: { label:'Items Sold', val: rows.reduce((s,r)=>s+r.qty,0) }, card4: { label:'Total Profit', val: `$${Math.round(totalProfit).toLocaleString()}` } });
        break;
      }
      case 'Stock Report': {
        const rows = await window.electron.invoke('reports:stock');
        setData(rows);
        setStats({ card1:{ label:'Total Products', val: rows.length }, card2:{ label:'Total Stock Qty', val: rows.reduce((s,r)=>s+r.current_stock,0) }, card3:{ label:'Stock Value (Cost)', val:`$${rows.reduce((s,r)=>s+(r.current_stock*r.purchase_price),0).toLocaleString()}` }, card4:{ label:'Stock Value (Selling)', val:`$${rows.reduce((s,r)=>s+(r.current_stock*r.sales_price),0).toLocaleString()}` } });
        break;
      }
      case 'Customer Outstanding': {
        const rows = await window.electron.invoke('reports:customerOutstanding');
        setData(rows);
        const totalBal = rows.reduce((s,r)=>s+r.balance,0);
        setStats({ card1:{label:'Total Credit Sales',val:`$${rows.reduce((s,r)=>s+r.total_amount,0).toLocaleString()}`}, card2:{label:'Total Received',val:`$${rows.reduce((s,r)=>s+r.paid_amount,0).toLocaleString()}`}, card3:{label:'Total Outstanding',val:`$${totalBal.toLocaleString()}`}, card4:{label:'Overdue Amount',val:`$${rows.filter(r=>r.balance>0).reduce((s,r)=>s+r.balance,0).toLocaleString()}`} });
        break;
      }
      case 'Vendor Outstanding': {
        const rows = await window.electron.invoke('reports:vendorOutstanding');
        setData(rows);
        setStats({ card1:{label:'Total Purchases',val:`$${rows.reduce((s,r)=>s+r.total_amount,0).toLocaleString()}`}, card2:{label:'Total Paid',val:`$${rows.reduce((s,r)=>s+r.paid_amount,0).toLocaleString()}`}, card3:{label:'Outstanding',val:`$${rows.reduce((s,r)=>s+r.balance,0).toLocaleString()}`}, card4:{label:'Overdue',val:`$${rows.filter(r=>r.balance>0).reduce((s,r)=>s+r.balance,0).toLocaleString()}`} });
        break;
      }
      case 'Profit & Loss': {
        const rows = await window.electron.invoke('reports:profitLoss', { from: dateFrom, to: dateTo });
        setData(rows);
        const totalProfit = rows.reduce((s,r)=>s+(r.total_profit||0),0);
        const totalRev = rows.reduce((s,r)=>s+(r.units_sold*r.sales_price),0);
        const totalCost = rows.reduce((s,r)=>s+(r.units_sold*r.cost_price),0);
        setStats({ card1:{label:'Total Revenue',val:`$${totalRev.toLocaleString()}`}, card2:{label:'Total Cost',val:`$${totalCost.toLocaleString()}`}, card3:{label:'Gross Profit',val:`$${totalProfit.toLocaleString()}`}, card4:{label:'Profit Margin',val: totalRev>0 ? `${((totalProfit/totalRev)*100).toFixed(2)}%` : '0%'} });
        break;
      }
      case 'Balance Sheet': {
        const bs = await window.electron.invoke('reports:balanceSheet');
        setData([]);
        setStats(bs);
        break;
      }
      default: setData([]); setStats({});
    }
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab);
    XLSX.writeFile(wb, `${activeTab.replace(/ /g,'_')}_${today}.xlsx`);
  }

  const colMap = {
    'Sales Report': ['date','bill_no','customer_name','item_name','qty','rate','amount','payment_status','payment_mode','profit'],
    'Purchase Report': ['date','bill_no','vendor_name','item_name','qty','purchase_price','amount','payment_status'],
    'Stock Report': ['item_name','category','opening_stock','purchase_qty','sales_qty','current_stock','purchase_value','sales_value','profit_margin'],
    'Customer Outstanding': ['customer_name','invoice_no','invoice_date','total_amount','paid_amount','balance'],
    'Vendor Outstanding': ['vendor_name','bill_no','bill_date','total_amount','paid_amount','balance'],
    'Profit & Loss': ['product','units_sold','cost_price','sales_price','total_profit','margin'],
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Reports</div>
        <div className="page-subtitle">Generate And Analyze Business Reports</div>
      </div>

      <div className="tab-pills" style={{ flexWrap:'wrap' }}>
        {TABS.map(t => <div key={t} className={`tab-pill ${activeTab===t?'active':''}`} onClick={() => setActiveTab(t)}>{t}</div>)}
      </div>

      <div className="card">
        {/* Report header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:17 }}>{activeTab}</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>Detailed Analysis And Trends</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {activeTab !== 'Balance Sheet' && activeTab !== 'Stock Report' && (
              <>
                <input type="date" className="form-input" style={{ width:140 }} value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
                <span style={{ color:'#6b7280' }}>to</span>
                <input type="date" className="form-input" style={{ width:140 }} value={dateTo} onChange={e=>setDateTo(e.target.value)} />
              </>
            )}
            <button className="btn btn-outline btn-sm" onClick={exportExcel}>Export Excel ↑</button>
            <button className="btn btn-outline btn-sm" onClick={() => window.print()}>Export PDF 🖨</button>
          </div>
        </div>

        {/* Stat cards */}
        {stats.card1 && (
          <div className="stat-cards" style={{ marginBottom:20 }}>
            {[stats.card1, stats.card2, stats.card3, stats.card4].filter(Boolean).map((c,i) => (
              <div key={i} className={['card blue','card pink','card yellow','card green'][i]} style={{ borderRadius:12, padding:18, background: ['#dbeafe','#fce7f3','#fef9c3','#dcfce7'][i] }}>
                <div style={{ fontSize:12, color:'#6b7280' }}>{c.label}</div>
                <div style={{ fontSize:24, fontWeight:700, marginTop:6 }}>{c.val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Balance Sheet special layout */}
        {activeTab === 'Balance Sheet' && stats.cashAccounts && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:12, borderLeft:'3px solid #22c55e', paddingLeft:10 }}>Assets</div>
              <table className="data-table">
                <thead><tr><th>Account Details</th><th>Amount</th></tr></thead>
                <tbody>
                  <tr><td colSpan={2} style={{color:'#9ca3af',fontSize:11,fontWeight:600,paddingTop:10}}>CURRENT ASSETS</td></tr>
                  {stats.cashAccounts?.map((a,i) => (
                    <tr key={i}><td>{a.account_name}{a.is_primary?<span className="badge badge-blue" style={{marginLeft:6,fontSize:10}}>Primary</span>:null}</td><td>{a.current_balance?.toLocaleString()}</td></tr>
                  ))}
                  <tr><td>Closing Stock</td><td>{stats.closingStock?.toLocaleString()}</td></tr>
                  <tr><td>Customer Outstanding</td><td>{stats.customerOutstanding?.toLocaleString()}</td></tr>
                  <tr style={{ borderTop:'2px solid #111' }}><td style={{ fontWeight:700 }}>TOTAL ASSETS</td><td style={{ fontWeight:700, color:'#16a34a' }}>${((stats.cashAccounts?.reduce((s,a)=>s+a.current_balance,0)||0) + (stats.closingStock||0) + (stats.customerOutstanding||0)).toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:12, borderLeft:'3px solid #3b82f6', paddingLeft:10 }}>Liabilities & Equity</div>
              <table className="data-table">
                <thead><tr><th>Account Details</th><th>Amount</th></tr></thead>
                <tbody>
                  <tr><td colSpan={2} style={{color:'#9ca3af',fontSize:11,fontWeight:600,paddingTop:10}}>CURRENT LIABILITIES</td></tr>
                  <tr><td>Vendor Outstanding</td><td>{stats.vendorOutstanding?.toLocaleString()}</td></tr>
                  <tr><td colSpan={2} style={{color:'#9ca3af',fontSize:11,fontWeight:600,paddingTop:10}}>EQUITY</td></tr>
                  <tr><td>Owner Capital Account</td><td>{stats.ownerCapital?.toLocaleString()}</td></tr>
                  <tr><td>Retained Earnings (Profit)</td><td>{Math.round(stats.retainedEarnings||0).toLocaleString()}</td></tr>
                  <tr style={{ borderTop:'2px solid #111' }}><td style={{ fontWeight:700 }}>TOTAL LIABILITIES + EQUITY</td><td style={{ fontWeight:700, color:'#3b82f6' }}>${((stats.vendorOutstanding||0) + (stats.ownerCapital||0) + (stats.retainedEarnings||0)).toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Generic table for other reports */}
        {activeTab !== 'Balance Sheet' && colMap[activeTab] && (
          <table className="data-table">
            <thead>
              <tr>{colMap[activeTab].map(col => <th key={col}>{col.replace(/_/g,' ').toUpperCase()}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  {colMap[activeTab].map(col => (
                    <td key={col}>
                      {col === 'profit' || col === 'total_profit' ? <span className="amount-positive">${(row[col]||0).toLocaleString()}</span>
                      : col === 'balance' && row[col] > 0 ? <span className="amount-negative">${row[col]?.toLocaleString()}</span>
                      : col === 'margin' ? `${row[col]}%`
                      : row[col] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={colMap[activeTab].length} style={{ textAlign:'center', color:'#9ca3af', padding:24 }}>No data for selected period</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
