/**
 * SETTINGS PAGE
 * Claude Code: Build per SKILL.md Section 22 (Screens 29-34)
 * Sub-tabs: Company Profile | Account Management | User Management | Branch Management | Backup & Security
 */
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const MODULES = ['dashboard','billing','inventory','vendors','banking','expenses','reports','settings'];
const ACTIONS = ['view','create','edit','delete'];
const ROLES = ['Owner','Accountant','Billing Operator','Inventory Manager'];

const MODULE_META = {
  dashboard:  { label: 'Dashboard',            icon: '⊞', desc: 'Overview, stats & charts' },
  billing:    { label: 'Billing & Invoice',     icon: '🧾', desc: 'Create & manage invoices' },
  inventory:  { label: 'Inventory & Services',  icon: '📦', desc: 'Products, stock & categories' },
  vendors:    { label: 'Vendors & Purchases',   icon: '🚚', desc: 'Vendors, POs & bills' },
  banking:    { label: 'Banking',               icon: '🏦', desc: 'Accounts & transactions' },
  expenses:   { label: 'Expenses',              icon: '💵', desc: 'Expense tracking' },
  reports:    { label: 'Reports',               icon: '📊', desc: 'Analytics & exports' },
  settings:   { label: 'Settings',              icon: '⚙️', desc: 'Company & user settings' },
};
const ACCOUNT_TYPES = ['Cash','Bank','Capital','Sales','Purchase','Expense'];
const TABS = ['Company Profile','Account Management','User Management','Branch Management','Backup & Security'];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('Company Profile');
  const { currentUser } = useAuth();

  const getTabIcon = (tab) => {
    switch(tab) {
      case 'Company Profile': return '🏢';
      case 'Account Management': return '📒';
      case 'User Management': return '👥';
      case 'Branch Management': return '🏪';
      case 'Backup & Security': return '🔒';
      default: return '⚙️';
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-subtitle">Manage Your Business Settings And Preferences</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:20 }}>
        {/* Left sub-nav */}
        <div className="card" style={{ padding:0, overflow:'hidden', alignSelf:'start' }}>
          {TABS.map(tab => (
            <div key={tab} onClick={() => setActiveTab(tab)} style={{ padding:'14px 18px', cursor:'pointer', fontSize:13, fontWeight: activeTab===tab ? 600 : 400, background: activeTab===tab ? '#f9fafb' : '#fff', borderLeft: activeTab===tab ? '3px solid #111' : '3px solid transparent', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:10 }}>
              <span>{getTabIcon(tab)}</span>
              {tab}
            </div>
          ))}
        </div>

        {/* Right content */}
        <div>
          {activeTab === 'Company Profile' && <CompanyProfile />}
          {activeTab === 'Account Management' && <AccountManagement />}
          {activeTab === 'User Management' && <UserManagement />}
          {activeTab === 'Branch Management' && <BranchManagement />}
          {activeTab === 'Backup & Security' && <BackupSecurity />}
        </div>
      </div>
    </div>
  );
}

// ── COMPANY PROFILE ──────────────────────────────────────────────────────────
function CompanyProfile() {
  const [form, setForm] = useState({ company_name:'', mobile:'', email:'', address:'', logo_path:'' });
  useEffect(() => { window.electron.invoke('settings:getCompany').then(d => d && setForm(d)); }, []);

  async function save() {
    await window.electron.invoke('settings:saveCompany', form);
    toast.success('Company profile saved!');
  }

  async function uploadLogo() {
    const filePath = await window.electron.invoke('settings:chooseLogoFile');
    if (!filePath) return;
    const r = await window.electron.invoke('settings:uploadLogo', { filePath });
    if (r.success) {
      toast.success('Logo uploaded!');
      setForm(p => ({...p, logo_path: r.logo_path}));
    } else {
      toast.error(r.error || 'Failed to upload logo');
    }
  }

  return (
    <div className="card">
      <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>Company Profile</div>
      <div style={{ fontSize:13, color:'#6b7280', marginBottom:24 }}>Manage your company information</div>

      {/* Logo */}
      <div style={{ display:'flex', gap:20, alignItems:'center', padding:20, border:'1px solid #e5e7eb', borderRadius:10, marginBottom:24 }}>
        <div style={{ width:80, height:80, border:'2px dashed #d1d5db', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#9ca3af' }}>
          {form.logo_path ? '📎' : 'NO LOGO'}
        </div>
        <div>
          <div style={{ fontWeight:600, marginBottom:4 }}>Company Logo</div>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:10 }}>Recommended size: 512×512px (PNG, SVG, or JPG)</div>
          {form.logo_path && <div style={{ fontSize:11, color:'#4b5563', marginBottom:8 }}>{form.logo_path}</div>}
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-black btn-sm" onClick={uploadLogo}>↑ Upload New Logo</button>
            {form.logo_path && <button className="btn btn-outline btn-sm" onClick={() => setForm(p => ({...p, logo_path:''}))}>Remove</button>}
          </div>
        </div>
      </div>

      <div style={{ fontWeight:600, fontSize:15, marginBottom:16 }}>General Information</div>
      <div className="form-group"><label className="form-label">Company Name</label><input className="form-input" value={form.company_name} onChange={e=>setForm({...form,company_name:e.target.value})} /></div>
      <div className="form-grid-2">
        <div className="form-group"><label className="form-label">Mobile Number</label><input className="form-input" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
      </div>
      <div className="form-group"><label className="form-label">Address</label><textarea className="form-input" rows={3} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} /></div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
        <button className="btn btn-outline">Cancel</button>
        <button className="btn btn-black" onClick={save}>💾 Save</button>
      </div>

      <CurrencyLanguage />
    </div>
  );
}

// ── ACCOUNT MANAGEMENT ───────────────────────────────────────────────────────
function AccountManagement() {
  const [accounts, setAccounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ account_name:'', account_type:'', opening_balance:'', as_of_date: new Date().toISOString().split('T')[0] });

  useEffect(() => { window.electron.invoke('accounts:getAll').then(setAccounts); }, []);

  const totalAssets = accounts.filter(a=>['Cash','Bank'].includes(a.account_type)).reduce((s,a)=>s+a.current_balance,0);
  const totalLiab = accounts.filter(a=>a.account_type==='Expense').reduce((s,a)=>s+a.opening_balance,0);

  const typeBadge = t => ({ Cash:'badge-blue', Bank:'badge-blue', Capital:'badge-green', Sales:'badge-green', Purchase:'badge-orange', Expense:'badge-red' }[t] || 'badge-grey');
  const typeAvatar = t => ({ Cash:'#3b82f6', Bank:'#3b82f6', Capital:'#22c55e', Sales:'#14b8a6', Purchase:'#f97316', Expense:'#ef4444' }[t] || '#9ca3af');

  async function saveAccount() {
    await window.electron.invoke('accounts:create', { ...form, opening_balance: parseFloat(form.opening_balance) || 0 });
    toast.success('Account created!');
    setShowModal(false);
    window.electron.invoke('accounts:getAll').then(setAccounts);
  }

  return (
    <div className="card">
      <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>Account Management</div>
      <div style={{ fontSize:13, color:'#6b7280', marginBottom:20 }}>Manage your chart of accounts</div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
        <div style={{ padding:16, background:'#f0fdf4', borderRadius:10 }}>
          <div style={{ fontSize:12, color:'#6b7280' }}>Total Assets</div>
          <div style={{ fontSize:22, fontWeight:700 }}>${totalAssets.toLocaleString()}</div>
        </div>
        <div style={{ padding:16, background:'#fef2f2', borderRadius:10 }}>
          <div style={{ fontSize:12, color:'#6b7280' }}>Total Liabilities</div>
          <div style={{ fontSize:22, fontWeight:700 }}>${totalLiab.toLocaleString()}</div>
        </div>
        <div style={{ padding:16, background:'#eff6ff', borderRadius:10 }}>
          <div style={{ fontSize:12, color:'#6b7280' }}>Net Equity</div>
          <div style={{ fontSize:22, fontWeight:700 }}>${(totalAssets - totalLiab).toLocaleString()}</div>
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
        <button className="btn btn-black" onClick={() => setShowModal(true)}>+ Add New Account</button>
      </div>

      <table className="data-table">
        <thead><tr><th>Account Name</th><th>Account Type</th><th>Opening Balance</th><th>Created Date</th><th>Action</th></tr></thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.id}>
              <td style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background: typeAvatar(a.account_type), color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12 }}>{a.account_name[0]}</div>
                {a.account_name}
              </td>
              <td><span className={`badge ${typeBadge(a.account_type)}`}>{a.account_type}</span></td>
              <td>${a.opening_balance?.toLocaleString()}</td>
              <td>{a.created_at?.split('T')[0]}</td>
              <td>✏️</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ background:'#eff6ff', borderRadius:8, padding:12, marginTop:16, fontSize:12, color:'#374151', display:'flex', gap:8 }}>
        <span>ℹ️</span> Deleting an account is only possible if it has no transaction history.
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            <div className="modal-title">Add New Account</div>
            <div className="form-group"><label className="form-label">Account Name</label><input className="form-input" placeholder="e.g. HDFC Current Account" value={form.account_name} onChange={e=>setForm({...form,account_name:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Account Type</label><select className="form-select" value={form.account_type} onChange={e=>setForm({...form,account_type:e.target.value})}><option value="">Select an account type</option>{ACCOUNT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Opening Balance</label><input className="form-input" type="number" placeholder="0.00" value={form.opening_balance} onChange={e=>setForm({...form,opening_balance:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">As of Date</label><input type="date" className="form-input" value={form.as_of_date} onChange={e=>setForm({...form,as_of_date:e.target.value})} /></div>
            </div>
            <div style={{ background:'#eff6ff', borderRadius:8, padding:10, fontSize:12, color:'#374151', marginBottom:16 }}>ℹ️ This opening balance will be recorded as the initial entry for this ledger account.</div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-black" onClick={saveAccount}>Save Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── USER MANAGEMENT ──────────────────────────────────────────────────────────
function UserManagement() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPerms, setShowPerms] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:'', mobile:'', email:'', password:'', role:'', branch_id:'' });
  const [permsMap, setPermsMap] = useState({});
  const { currentUser } = useAuth();

  useEffect(() => {
    window.electron.invoke('users:getAll').then(setUsers).catch(() => {});
    window.electron.invoke('branches:getAll').then(setBranches).catch(() => {});
  }, []);

  async function saveUser() {
    if (!form.name || !form.password || !form.role) { toast.error('Name, password and role are required'); return; }
    if (editing) {
      await window.electron.invoke('users:update', { id: editing.id, ...form });
      toast.success('User updated!');
    } else {
      await window.electron.invoke('users:create', form);
      toast.success('User created!');
    }
    setShowModal(false);
    window.electron.invoke('users:getAll').then(setUsers);
  }

  function openAdd() {
    setEditing(null);
    setForm({ name:'', mobile:'', email:'', password:'', role:'', branch_id:'' });
    setShowModal(true);
  }

  function openEdit(user) {
    setEditing(user);
    setForm({ name: user.name, mobile: user.mobile, email: user.email, password:'', role: user.role, branch_id: user.branch_id || '' });
    setShowModal(true);
  }

  async function toggleActive(user) {
    await window.electron.invoke('users:toggleActive', { id: user.id, is_active: user.is_active ? 0 : 1 });
    window.electron.invoke('users:getAll').then(setUsers);
  }

  async function openPerms(user) {
    const perms = await window.electron.invoke('permissions:getForUser', { userId: user.id, role: user.role });
    setPermsMap(perms || {});
    setShowPerms(user);
  }

  async function savePerms() {
    await window.electron.invoke('permissions:saveForUser', { userId: showPerms.id, permissions: permsMap });
    toast.success('Permissions saved!');
    setShowPerms(null);
  }

  function togglePerm(mod, act) {
    setPermsMap(prev => ({ ...prev, [mod]: { ...(prev[mod]||{}), [act]: !(prev[mod]?.[act]) } }));
  }

  const roleBadge = r => r==='Owner'?'badge-blue':r==='Accountant'?'badge-grey':'badge-grey';

  return (
    <div className="card">
      <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>User Management</div>
      <div style={{ fontSize:13, color:'#6b7280', marginBottom:20 }}>Manage your workspace members</div>

      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <input className="form-input" style={{ width:280 }} placeholder="Search users by name, email, or role..." />
        {currentUser?.role === 'Owner' && <button className="btn btn-black" onClick={openAdd}>+ Add New User</button>}
      </div>

      <table className="data-table">
        <thead><tr><th>User Name</th><th>Mobile Number</th><th>Role</th><th>Branch</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:'#111', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{u.name[0]}</div>
                  <div><div style={{ fontWeight:600 }}>{u.name}</div><div style={{ fontSize:11, color:'#9ca3af' }}>{u.email}</div></div>
                </div>
              </td>
              <td>{u.mobile}</td>
              <td><span className={`badge ${roleBadge(u.role)}`}>{u.role}</span></td>
              <td>{branches.find(b => b.id === u.branch_id)?.name || '—'}</td>
              <td>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div onClick={() => toggleActive(u)} style={{ width:36, height:20, borderRadius:10, background: u.is_active?'#111':'#d1d5db', cursor:'pointer', position:'relative', transition:'background 0.2s' }}>
                    <div style={{ width:16, height:16, background:'#fff', borderRadius:'50%', position:'absolute', top:2, left: u.is_active?18:2, transition:'left 0.2s' }} />
                  </div>
                  <span style={{ fontSize:12, color:'#6b7280' }}>{u.is_active?'Active':'Inactive'}</span>
                </div>
              </td>
              <td style={{ display:'flex', gap:8 }}>
                {currentUser?.role === 'Owner' && <button className="btn btn-outline btn-sm" onClick={() => openPerms(u)} title="Edit Permissions">🔑</button>}
                <button className="btn btn-outline btn-sm" title="Edit" onClick={() => openEdit(u)}>✏️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            <div className="modal-title">{editing ? 'Edit User' : 'Add New User'}</div>
            <div className="modal-subtitle">{editing ? 'Update user information' : 'Invite a new member to your workspace.'}</div>
            <div className="form-group"><label className="form-label">User Name *</label><input className="form-input" placeholder="e.g. John Doe" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Mobile Number</label><input className="form-input" placeholder="(555) 000-0000" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" placeholder="user@email.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            {!editing && <div className="form-group"><label className="form-label">Password *</label><input type="password" className="form-input" placeholder="Min 8 characters" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>}
            <div className="form-group"><label className="form-label">User Role *</label><select className="form-select" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="">Select user role</option>{ROLES.map(r=><option key={r}>{r}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Branch</label><select className="form-select" value={form.branch_id} onChange={e=>setForm({...form,branch_id:e.target.value})}><option value="">No Branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-black" onClick={saveUser}>{editing ? 'Update' : 'Save'} User</button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPerms && <PermissionsModal user={showPerms} permsMap={permsMap} onToggle={togglePerm} onSave={savePerms} onReset={async () => { await window.electron.invoke('permissions:saveForUser',{userId:showPerms.id,permissions:{}}); setShowPerms(null); toast.success('Reset to role defaults'); }} onClose={() => setShowPerms(null)} />}
    </div>
  );
}

// ── PERMISSIONS MODAL ────────────────────────────────────────────────────────
function PermissionsModal({ user, permsMap, onToggle, onSave, onReset, onClose }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Tab is visible if `view` permission is true
  const canView = (mod) => !!permsMap?.[mod]?.view;

  // Toggle the `view` permission (controls tab visibility in sidebar)
  function toggleTabAccess(mod) {
    onToggle(mod, 'view');
    // If disabling view, also remove create/edit/delete
    if (canView(mod)) {
      ['create','edit','delete'].forEach(act => {
        if (permsMap?.[mod]?.[act]) onToggle(mod, act);
      });
    }
  }

  const visibleCount = MODULES.filter(m => canView(m)).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:'#fff', borderRadius:16, width:620, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.18)' }}
      >
        {/* Header */}
        <div style={{ padding:'24px 28px 20px', borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:'#111', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16 }}>{user.name[0]}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:16 }}>{user.name}</div>
                <div style={{ fontSize:12, color:'#64748b' }}>Role: <strong>{user.role}</strong> · {visibleCount} of {MODULES.length} tabs visible</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94a3b8', lineHeight:1 }}>✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY:'auto', padding:'24px 28px', flex:1 }}>

          {/* Tab Access Section */}
          <div style={{ marginBottom:24 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>Tab Visibility</div>
            <div style={{ fontSize:12, color:'#64748b', marginBottom:16 }}>Control which sidebar tabs this user can see and access.</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {MODULES.map(mod => {
                const meta = MODULE_META[mod];
                const active = canView(mod);
                return (
                  <div
                    key={mod}
                    onClick={() => toggleTabAccess(mod)}
                    style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'14px 16px', borderRadius:12, cursor:'pointer',
                      border: active ? '1.5px solid #111' : '1.5px solid #e2e8f0',
                      background: active ? '#f8fafc' : '#fff',
                      transition:'all 0.15s',
                    }}
                  >
                    {/* Module icon */}
                    <div style={{ width:36, height:36, borderRadius:10, background: active ? '#111' : '#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>
                      {meta.icon}
                    </div>
                    {/* Label */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13, color: active ? '#111' : '#64748b' }}>{meta.label}</div>
                      <div style={{ fontSize:11, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{meta.desc}</div>
                    </div>
                    {/* Toggle */}
                    <div style={{ width:36, height:20, borderRadius:10, background: active ? '#111' : '#d1d5db', flexShrink:0, position:'relative', transition:'background 0.2s' }}>
                      <div style={{ width:16, height:16, background:'#fff', borderRadius:'50%', position:'absolute', top:2, left: active ? 18 : 2, transition:'left 0.2s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Advanced permissions */}
          <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:16 }}>
            <button
              onClick={() => setShowAdvanced(v => !v)}
              style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontWeight:600, fontSize:13, color:'#374151', padding:0, marginBottom: showAdvanced ? 16 : 0 }}
            >
              <span style={{ fontSize:11, color:'#94a3b8' }}>{showAdvanced ? '▼' : '▶'}</span>
              Advanced Permissions (Create / Edit / Delete)
            </button>

            {showAdvanced && (
              <table className="data-table" style={{ marginTop:4 }}>
                <thead>
                  <tr>
                    <th>Module</th>
                    <th style={{ textAlign:'center' }}>View</th>
                    <th style={{ textAlign:'center' }}>Create</th>
                    <th style={{ textAlign:'center' }}>Edit</th>
                    <th style={{ textAlign:'center' }}>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(mod => (
                    <tr key={mod} style={{ opacity: canView(mod) ? 1 : 0.45 }}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span>{MODULE_META[mod].icon}</span>
                          <span style={{ fontWeight:500, fontSize:13 }}>{MODULE_META[mod].label}</span>
                        </div>
                      </td>
                      {ACTIONS.map(act => (
                        <td key={act} style={{ textAlign:'center' }}>
                          <input
                            type="checkbox"
                            checked={!!permsMap?.[mod]?.[act]}
                            disabled={act !== 'view' && !canView(mod)}
                            onChange={() => onToggle(mod, act)}
                            style={{ cursor: act !== 'view' && !canView(mod) ? 'not-allowed' : 'pointer', width:15, height:15 }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 28px', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button className="btn btn-outline btn-sm" onClick={onReset}>↺ Reset to Role Defaults</button>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn btn-black" onClick={onSave}>Save Permissions</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BACKUP & SECURITY ─────────────────────────────────────────────────────────
function BackupSecurity() {
  const [logs, setLogs] = useState([]);

  function load() {
    window.electron.invoke('backup:getLogs').then(setLogs);
  }

  useEffect(() => { load(); }, []);

  async function backupNow() {
    await window.electron.invoke('backup:now');
    toast.success('Backup completed!');
    load();
  }

  async function restoreBackup() {
    const filePath = await window.electron.invoke('settings:chooseRestoreFile');
    if (!filePath) return;
    if (!window.confirm('This will replace the current database. Are you sure?')) return;
    const r = await window.electron.invoke('settings:restoreBackup', { filePath });
    if (r.success) {
      toast.success('Database restored! Please restart the app.');
      load();
    } else {
      toast.error('Restore failed');
    }
  }

  return (
    <div className="card">
      <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>Backup & Restore</div>
      <div style={{ fontSize:13, color:'#6b7280', marginBottom:20 }}>Manage your database security and recovery points</div>

      <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:16, display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:24 }}>🛡️</span>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:700, fontSize:14 }}>CURRENT STATUS</span>
              <span className="badge badge-green">SYSTEM HEALTHY</span>
            </div>
            <div style={{ fontWeight:600, fontSize:13, marginTop:2 }}>Last Successful Backup: {logs[0]?.date_time?.split('T')[0] || 'Never'}</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>Next scheduled backup: Today, 00:00 UTC</div>
          </div>
        </div>
        <button className="btn btn-outline btn-sm">View Details</button>
      </div>

      <div style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:16, display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:600 }}>Auto Backup</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Automatically back up your data daily at midnight (00:00 UTC)</div>
        </div>
        <div style={{ width:44, height:24, borderRadius:12, background:'#111', cursor:'pointer', position:'relative' }}>
          <div style={{ width:20, height:20, background:'#fff', borderRadius:'50%', position:'absolute', top:2, right:2 }} />
        </div>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:24 }}>
        <button className="btn btn-black" onClick={backupNow}>☁ Backup Now</button>
        <button className="btn btn-outline" onClick={restoreBackup}>↺ Restore Data</button>
      </div>

      <div style={{ fontWeight:700, marginBottom:12 }}>Recent Activity</div>
      <table className="data-table">
        <thead><tr><th>Activity</th><th>Date & Time</th><th>Size</th><th>Status</th></tr></thead>
        <tbody>
          {logs.length === 0 && <tr><td colSpan={4} style={{ textAlign:'center', color:'#9ca3af', padding:20 }}>No backups yet</td></tr>}
          {logs.map((l,i) => (
            <tr key={i}>
              <td style={{ display:'flex', alignItems:'center', gap:8 }}><span>{l.type?.includes('Manual')?'👤':'⏱'}</span>{l.type}</td>
              <td>{l.date_time?.replace('T',' ').split('.')[0]}</td>
              <td>{l.size_mb ? `${l.size_mb} MB` : '--'}</td>
              <td><span className={`badge ${l.status==='Success'?'badge-green':'badge-red'}`}>● {l.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── CURRENCY & LANGUAGE ──────────────────────────────────────────────────────
function CurrencyLanguage() {
  const [settings, setSettings] = useState({ currency:'INR', currency_symbol:'₹', language:'en', date_format:'DD/MM/YYYY' });
  useEffect(() => { window.electron.invoke('settings:getAll').then(s => { if(s) setSettings(prev => ({...prev, ...s})); }).catch(() => {}); }, []);

  async function save() {
    await window.electron.invoke('settings:saveAll', settings);
    toast.success('Settings saved!');
  }

  return (
    <div style={{ marginTop:32, borderTop:'1px solid #e5e7eb', paddingTop:24 }}>
      <div style={{ fontWeight:600, fontSize:16, marginBottom:16 }}>Currency & Language</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, maxWidth:600 }}>
        <div>
          <label className="form-label">Currency</label>
          <select className="form-select" value={settings.currency} onChange={e => setSettings(p => ({...p, currency:e.target.value}))}>
            <option value="INR">INR — Indian Rupee</option>
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="AED">AED — UAE Dirham</option>
          </select>
        </div>
        <div>
          <label className="form-label">Currency Symbol</label>
          <input className="form-input" value={settings.currency_symbol} onChange={e => setSettings(p => ({...p, currency_symbol:e.target.value}))} placeholder="₹" />
        </div>
        <div>
          <label className="form-label">Language</label>
          <select className="form-select" value={settings.language} onChange={e => setSettings(p => ({...p, language:e.target.value}))}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="ta">Tamil</option>
            <option value="te">Telugu</option>
          </select>
        </div>
        <div>
          <label className="form-label">Date Format</label>
          <select className="form-select" value={settings.date_format} onChange={e => setSettings(p => ({...p, date_format:e.target.value}))}>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
      </div>
      <button className="btn btn-black" style={{ marginTop:16 }} onClick={save}>Save Currency & Language</button>
    </div>
  );
}

// ── BRANCH MANAGEMENT ────────────────────────────────────────────────────────
function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', address: '', contact: '' });

  useEffect(() => { load(); }, []);

  function load() {
    window.electron.invoke('branches:getAll').then(setBranches).catch(() => {});
  }

  function openAdd() {
    setEditing(null);
    setForm({ name:'', code:'', address:'', contact:'' });
    setShowModal(true);
  }

  function openEdit(b) {
    setEditing(b);
    setForm({ name:b.name, code:b.code||'', address:b.address||'', contact:b.contact||'' });
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('Branch name required');
      return;
    }
    if (editing) {
      await window.electron.invoke('branches:update', { id: editing.id, ...form });
    } else {
      await window.electron.invoke('branches:create', form);
    }
    toast.success(editing ? 'Branch updated' : 'Branch created');
    setShowModal(false);
    load();
  }

  async function deleteBranch(id) {
    if (!window.confirm('Delete this branch?')) return;
    const r = await window.electron.invoke('branches:delete', { id });
    if (r.success) {
      toast.success('Branch deleted');
      load();
    } else {
      toast.error(r.error || 'Cannot delete branch');
    }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:18 }}>Branch Management</div>
          <div style={{ fontSize:13, color:'#6b7280' }}>Manage store branches</div>
        </div>
        <button className="btn btn-black" onClick={openAdd}>+ Add Branch</button>
      </div>
      <table className="data-table">
        <thead><tr><th>Branch Name</th><th>Code</th><th>Address</th><th>Contact</th><th>Actions</th></tr></thead>
        <tbody>
          {branches.length === 0 && <tr><td colSpan={5} style={{ textAlign:'center', color:'#9ca3af', padding:20 }}>No branches yet</td></tr>}
          {branches.map(b => (
            <tr key={b.id}>
              <td style={{ fontWeight:600 }}>{b.name}</td>
              <td>{b.code || '—'}</td>
              <td>{b.address || '—'}</td>
              <td>{b.contact || '—'}</td>
              <td>
                <button className="btn btn-outline btn-sm" onClick={() => openEdit(b)} style={{ marginRight:8 }}>Edit</button>
                <button className="btn btn-sm" style={{ background:'#fee2e2', color:'#ef4444', border:'none' }} onClick={() => deleteBranch(b.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:12, padding:32, width:480, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>{editing ? 'Edit Branch' : 'Add Branch'}</div>
            <div style={{ fontSize:13, color:'#6b7280', marginBottom:24 }}>Branch details</div>
            <div style={{ display:'grid', gap:14 }}>
              <div>
                <label className="form-label">Branch Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value}))} placeholder="e.g. Main Branch" />
              </div>
              <div>
                <label className="form-label">Branch Code</label>
                <input className="form-input" value={form.code} onChange={e => setForm(p => ({...p, code:e.target.value}))} placeholder="e.g. BR-001" />
              </div>
              <div>
                <label className="form-label">Address</label>
                <input className="form-input" value={form.address} onChange={e => setForm(p => ({...p, address:e.target.value}))} placeholder="Branch address" />
              </div>
              <div>
                <label className="form-label">Contact</label>
                <input className="form-input" value={form.contact} onChange={e => setForm(p => ({...p, contact:e.target.value}))} placeholder="Phone / email" />
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:12, marginTop:24 }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-black" onClick={save}>{editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
