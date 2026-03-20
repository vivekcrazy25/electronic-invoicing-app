const bcrypt = require('bcryptjs');
const { ipcMain } = require('electron');

module.exports = function registerHandlers({ getDb }) {

  // ─── AUTH ────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:login', async (_, { username, password }) => {
    const db = getDb();
    const user = db.prepare(
      `SELECT * FROM users WHERE (name = ? OR mobile = ?) AND is_active = 1`
    ).get(username, username);
    if (!user) return { success: false, error: 'Invalid username or password.' };
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return { success: false, error: 'Invalid username or password.' };
    const { password: _pw, ...safeUser } = user;
    return { success: true, user: safeUser };
  });

  // ─── PERMISSIONS ─────────────────────────────────────────────────────────
  ipcMain.handle('permissions:getForUser', async (_, { userId, role }) => {
    const db = getDb();
    if (role === 'Owner') return null; // Owner has all
    const overrides = db.prepare(
      `SELECT p.module, p.action, up.granted FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = ?`
    ).all(userId);
    const rolePerms = db.prepare(
      `SELECT p.module, p.action, rp.granted FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id WHERE rp.role = ?`
    ).all(role);
    const map = {};
    for (const rp of rolePerms) {
      if (!map[rp.module]) map[rp.module] = {};
      map[rp.module][rp.action] = rp.granted === 1;
    }
    for (const up of overrides) {
      if (!map[up.module]) map[up.module] = {};
      map[up.module][up.action] = up.granted === 1;
    }
    return map;
  });

  ipcMain.handle('permissions:saveForUser', async (_, { userId, permissions }) => {
    const db = getDb();
    db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(userId);
    const getPerm = db.prepare('SELECT id FROM permissions WHERE module = ? AND action = ?');
    const ins = db.prepare('INSERT INTO user_permissions (user_id, permission_id, granted) VALUES (?,?,?)');
    for (const [module, actions] of Object.entries(permissions)) {
      for (const [action, granted] of Object.entries(actions)) {
        const perm = getPerm.get(module, action);
        if (perm) ins.run(userId, perm.id, granted ? 1 : 0);
      }
    }
    return { success: true };
  });

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  ipcMain.handle('dashboard:getStats', async () => {
    const db = getDb();
    const totalSale = db.prepare(`SELECT COALESCE(SUM(grand_total),0) as val FROM invoices WHERE status != 'Draft'`).get().val;
    const totalProfit = db.prepare(`SELECT COALESCE(SUM(ii.qty * (ii.rate - p.purchase_price)),0) as val FROM invoice_items ii JOIN products p ON p.id = ii.product_id JOIN invoices i ON i.id = ii.invoice_id WHERE i.status != 'Draft'`).get().val;
    const pendingPayment = db.prepare(`SELECT COALESCE(SUM(grand_total - paid_amount),0) as val FROM invoices WHERE is_credit_sale = 1 AND status != 'Draft'`).get().val;
    const cashBalance = db.prepare(`SELECT COALESCE(SUM(current_balance),0) as val FROM accounts WHERE account_type = 'Cash'`).get().val;
    const bankBalance = db.prepare(`SELECT COALESCE(SUM(current_balance),0) as val FROM accounts WHERE account_type = 'Bank'`).get().val;
    const lowStock = db.prepare(`SELECT COUNT(*) as val FROM products WHERE status IN ('Low','Critical') AND is_active = 1`).get().val;
    const monthlySales = db.prepare(`
      SELECT strftime('%m', invoice_date) as month, COALESCE(SUM(grand_total),0) as total
      FROM invoices WHERE status != 'Draft' AND strftime('%Y', invoice_date) = strftime('%Y','now')
      GROUP BY month ORDER BY month
    `).all();
    const recentInvoices = db.prepare(`SELECT * FROM invoices ORDER BY created_at DESC LIMIT 5`).all();
    const topItems = db.prepare(`
      SELECT ii.product_name, SUM(ii.qty) as units_sold, SUM(ii.amount) as revenue
      FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
      WHERE i.status != 'Draft'
      GROUP BY ii.product_name ORDER BY units_sold DESC LIMIT 7
    `).all();
    return { totalSale, totalProfit, pendingPayment, cashBalance, bankBalance, lowStock, monthlySales, recentInvoices, topItems };
  });

  // ─── INVOICES ─────────────────────────────────────────────────────────────
  ipcMain.handle('invoices:getAll', async (_, { status, search } = {}) => {
    const db = getDb();
    let q = `SELECT i.*, u.name as seller_name, (SELECT COUNT(*) FROM invoice_items WHERE invoice_id=i.id) as item_count FROM invoices i LEFT JOIN users u ON u.id = i.seller_id WHERE 1=1`;
    const params = [];
    if (status && status !== 'All') { q += ` AND i.status = ?`; params.push(status); }
    if (search) { q += ` AND (i.invoice_no LIKE ? OR i.customer_name LIKE ? OR i.customer_phone LIKE ?)`; const s = `%${search}%`; params.push(s, s, s); }
    q += ` ORDER BY i.created_at DESC`;
    return db.prepare(q).all(...params);
  });

  ipcMain.handle('invoices:getById', async (_, { id }) => {
    const db = getDb();
    const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(id);
    if (!invoice) return null;
    invoice.items = db.prepare(`SELECT * FROM invoice_items WHERE invoice_id = ?`).all(id);
    return invoice;
  });

  ipcMain.handle('invoices:create', async (_, data) => {
    const db = getDb();
    const year = new Date().getFullYear().toString().slice(-2);
    const last = db.prepare(`SELECT invoice_no FROM invoices ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (last) {
      const num = parseInt(last.invoice_no.replace(`ETS-${year}`, ''), 10);
      seq = isNaN(num) ? 1 : num + 1;
    }
    const invoice_no = `ETS-${year}${String(seq).padStart(3, '0')}`;
    const insert = db.prepare(`
      INSERT INTO invoices (invoice_no, invoice_date, customer_name, customer_phone, seller_id, branch_id,
        subtotal, tax_amount, grand_total, payment_mode, cash_amount, online_amount, internal_notes,
        status, type, is_credit_sale, paid_amount, created_by)
      VALUES (@invoice_no,@invoice_date,@customer_name,@customer_phone,@seller_id,@branch_id,
        @subtotal,@tax_amount,@grand_total,@payment_mode,@cash_amount,@online_amount,@internal_notes,
        @status,@type,@is_credit_sale,@paid_amount,@created_by)
    `);
    const result = insert.run({
      invoice_no,
      invoice_date: data.invoice_date,
      customer_name: data.customer_name || '',
      customer_phone: data.customer_phone || '',
      seller_id: data.seller_id || null,
      branch_id: data.branch_id || null,
      subtotal: data.subtotal || 0,
      tax_amount: data.tax_amount || 0,
      grand_total: data.grand_total || 0,
      payment_mode: data.payment_mode || 'Cash',
      cash_amount: data.split_cash || data.cash_amount || null,
      online_amount: data.split_card || data.online_amount || null,
      internal_notes: data.notes || data.internal_notes || '',
      status: data.status || 'Paid',
      type: data.type || 'Sale',
      is_credit_sale: data.is_credit_sale || 0,
      paid_amount: data.is_credit_sale ? 0 : data.grand_total,
      created_by: data.created_by || null,
    });
    const invoiceId = result.lastInsertRowid;

    // Insert items & update stock
    if (data.items && data.items.length) {
      const insItem = db.prepare(`INSERT INTO invoice_items (invoice_id, product_id, product_code, product_name, qty, rate, amount) VALUES (?,?,?,?,?,?,?)`);
      const updStock = db.prepare(`UPDATE products SET current_stock = current_stock - ?, status = CASE WHEN current_stock - ? <= 5 THEN 'Critical' WHEN current_stock - ? <= reorder_level THEN 'Low' ELSE 'Good' END WHERE id = ?`);
      for (const item of data.items) {
        insItem.run(invoiceId, item.product_id, item.product_code || item.sku || '', item.product_name || item.name || '', item.qty, item.rate, item.amount);
        if (data.status !== 'Draft') updStock.run(item.qty, item.qty, item.qty, item.product_id);
      }
    }
    // Notify on credit sale
    if (data.is_credit_sale) {
      db.prepare(`INSERT INTO notifications (type,title,message,link) VALUES (?,?,?,?)`)
        .run('credit_due', 'Credit Sale Created',
          `Invoice ${invoice_no} for ${data.customer_name || 'Walk-in'} (₹${data.grand_total}) recorded as credit sale`,
          '/billing');
    }
    return { success: true, invoice_no, id: invoiceId };
  });

  ipcMain.handle('invoices:updateStatus', async (_, { id, status, paid_amount }) => {
    const db = getDb();
    db.prepare(`UPDATE invoices SET status = ?, paid_amount = COALESCE(?, paid_amount), updated_at = datetime('now') WHERE id = ?`).run(status, paid_amount, id);
    return { success: true };
  });

  ipcMain.handle('invoices:delete', async (_, { id }) => {
    const db = getDb();
    db.prepare(`DELETE FROM invoices WHERE id = ?`).run(id);
    return { success: true };
  });

  // ─── RETURN & EXCHANGE ────────────────────────────────────────────────────
  ipcMain.handle('returns:getAll', async () => {
    const db = getDb();
    return db.prepare(`SELECT * FROM return_exchange ORDER BY date DESC`).all();
  });

  ipcMain.handle('returns:create', async (_, data) => {
    const db = getDb();
    const ins = db.prepare(`INSERT INTO return_exchange (original_invoice_id, invoice_no, customer_name, type, total_items_sold, items_returned, return_amount, exchange_amount, net_amount, status, created_by) VALUES (@original_invoice_id,@invoice_no,@customer_name,@type,@total_items_sold,@items_returned,@return_amount,@exchange_amount,@net_amount,@status,@created_by)`);
    const r = ins.run(data);
    // restore stock for returned items
    if (data.items) {
      const upd = db.prepare(`UPDATE products SET current_stock = current_stock + ? WHERE id = ?`);
      for (const item of data.items) if (item.returned_qty > 0) upd.run(item.returned_qty, item.product_id);
    }
    return { success: true, id: r.lastInsertRowid };
  });

  // ─── INVENTORY / PRODUCTS ─────────────────────────────────────────────────
  ipcMain.handle('products:getAll', async (_, { search, category, status } = {}) => {
    const db = getDb();
    let q = `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.is_active = 1`;
    const params = [];
    if (search) { q += ` AND (p.name LIKE ? OR p.sku LIKE ?)`; const s = `%${search}%`; params.push(s, s); }
    if (category && category !== 'All Categories') { q += ` AND c.name = ?`; params.push(category); }
    if (status && status !== 'All Status') { q += ` AND p.status = ?`; params.push(status); }
    return db.prepare(q).all(...params);
  });

  ipcMain.handle('products:findByBarcode', async (_, data) => {
    const db = getDb();
    const barcode = typeof data === 'string' ? data : data?.barcode;
    return db.prepare(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.barcode = ? AND p.is_active = 1`).get(barcode);
  });

  ipcMain.handle('products:create', async (_, data) => {
    const db = getDb();
    const last = db.prepare(`SELECT sku FROM products ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (last) { const n = parseInt(last.sku.replace('ITM-', ''), 10); seq = isNaN(n) ? 1 : n + 1; }
    const sku = `ITM-${String(seq).padStart(3, '0')}`;
    const initStock = data.current_stock || data.opening_stock || 0;
    const reorderLvl = data.low_stock_threshold || data.reorder_level || 10;
    db.prepare(`INSERT INTO products (sku, name, category_id, unit, hsn_code, purchase_price, selling_price, opening_stock, current_stock, reorder_level, barcode, description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(sku, data.name, data.category_id || null, data.unit || 'pcs', data.hsn_code || '', data.purchase_price || 0, data.selling_price || 0, initStock, initStock, reorderLvl, data.barcode || '', data.description || '');
    return { success: true, sku };
  });

  ipcMain.handle('products:update', async (_, { id, ...data }) => {
    const db = getDb();
    const reorderLvl = data.low_stock_threshold || data.reorder_level || 10;
    db.prepare(`UPDATE products SET name=?,category_id=?,unit=?,hsn_code=?,purchase_price=?,selling_price=?,current_stock=?,reorder_level=?,barcode=?,description=? WHERE id=?`)
      .run(data.name, data.category_id || null, data.unit || 'pcs', data.hsn_code || '', data.purchase_price || 0, data.selling_price || 0, data.current_stock || 0, reorderLvl, data.barcode || '', data.description || '', id);
    return { success: true };
  });

  ipcMain.handle('products:delete', async (_, { id }) => {
    const db = getDb();
    db.prepare(`UPDATE products SET is_active = 0 WHERE id = ?`).run(id);
    return { success: true };
  });

  ipcMain.handle('customers:getAll', async (_, { search } = {}) => {
    const db = getDb();
    if (search) return db.prepare(`SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ?`).all(`%${search}%`, `%${search}%`);
    return db.prepare(`SELECT * FROM customers ORDER BY name`).all();
  });

  ipcMain.handle('products:getInventoryStats', async () => {
    const db = getDb();
    const total = db.prepare(`SELECT COUNT(*) as val FROM products WHERE is_active=1`).get().val;
    const lowAlert = db.prepare(`SELECT COUNT(*) as val FROM products WHERE status IN ('Low','Critical') AND is_active=1`).get().val;
    const costVal = db.prepare(`SELECT COALESCE(SUM(current_stock*purchase_price),0) as val FROM products WHERE is_active=1`).get().val;
    const sellVal = db.prepare(`SELECT COALESCE(SUM(current_stock*selling_price),0) as val FROM products WHERE is_active=1`).get().val;
    return { total, lowAlert, costVal, sellVal };
  });

  ipcMain.handle('categories:getAll', async () => {
    const db = getDb();
    return db.prepare(`SELECT * FROM categories ORDER BY name`).all();
  });

  // ─── VENDORS ──────────────────────────────────────────────────────────────
  ipcMain.handle('vendors:getAll', async (_, { search } = {}) => {
    const db = getDb();
    if (search) return db.prepare(`SELECT * FROM vendors WHERE vendor_name LIKE ? OR company_name LIKE ?`).all(`%${search}%`, `%${search}%`);
    return db.prepare(`SELECT * FROM vendors ORDER BY created_at DESC`).all();
  });

  ipcMain.handle('vendors:create', async (_, data) => {
    const db = getDb();
    const r = db.prepare(`INSERT INTO vendors (vendor_name,company_name,email,phone,street_address,city,province_state,postal_code,account_name,account_number) VALUES (@vendor_name,@company_name,@email,@phone,@street_address,@city,@province_state,@postal_code,@account_name,@account_number)`).run(data);
    return { success: true, id: r.lastInsertRowid };
  });

  ipcMain.handle('vendors:delete', async (_, { id }) => {
    const db = getDb();
    db.prepare(`DELETE FROM vendors WHERE id = ?`).run(id);
    return { success: true };
  });

  // ─── PURCHASE INVOICES ────────────────────────────────────────────────────
  ipcMain.handle('purchases:getAll', async (_, { search } = {}) => {
    const db = getDb();
    let q = `SELECT pi.*, v.vendor_name, (SELECT COUNT(*) FROM purchase_invoice_items WHERE purchase_invoice_id=pi.id) as product_count, (SELECT COALESCE(SUM(qty),0) FROM purchase_invoice_items WHERE purchase_invoice_id=pi.id) as total_qty FROM purchase_invoices pi LEFT JOIN vendors v ON v.id = pi.vendor_id WHERE 1=1`;
    const params = [];
    if (search) { q += ` AND (pi.po_number LIKE ? OR v.vendor_name LIKE ?)`; const s = `%${search}%`; params.push(s, s); }
    q += ` ORDER BY pi.created_at DESC`;
    return db.prepare(q).all(...params);
  });

  ipcMain.handle('purchases:create', async (_, data) => {
    const db = getDb();
    const year = new Date().getFullYear();
    const last = db.prepare(`SELECT po_number FROM purchase_invoices ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (last) { const n = parseInt(last.po_number.split('-')[2], 10); seq = isNaN(n) ? 1 : n + 1; }
    const po_number = `PO-${year}-${String(seq).padStart(6, '0')}`;
    const vendor = db.prepare(`SELECT vendor_name FROM vendors WHERE id = ?`).get(data.vendor_id);
    const vendorName = vendor?.vendor_name || data.vendor_name || '';
    const r = db.prepare(`INSERT INTO purchase_invoices (po_number,vendor_id,vendor_name,purchase_date,subtotal,grand_total,purchase_note,status,pending_amount) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(po_number, data.vendor_id, vendorName, data.purchase_date, data.subtotal, data.grand_total, data.notes || '', data.status || 'Pending', data.grand_total);
    const piId = r.lastInsertRowid;
    if (data.items) {
      const ins = db.prepare(`INSERT INTO purchase_invoice_items (purchase_invoice_id,product_id,product_name,product_code,qty,price,total) VALUES (?,?,?,?,?,?,?)`);
      const upd = db.prepare(`UPDATE products SET current_stock = current_stock + ? WHERE id = ?`);
      for (const item of data.items) {
        ins.run(piId, item.product_id, item.name || item.product_name, item.sku || item.product_code || '', item.qty, item.rate || item.price, item.amount || item.total);
        if (data.status === 'Received') upd.run(item.qty, item.product_id);
      }
    }
    return { success: true, po_number, id: piId };
  });

  ipcMain.handle('purchases:delete', async (_, { id }) => {
    const db = getDb();
    db.prepare(`DELETE FROM purchase_invoice_items WHERE purchase_invoice_id = ?`).run(id);
    db.prepare(`DELETE FROM purchase_invoices WHERE id = ?`).run(id);
    return { success: true };
  });

  // ─── PAY BILLS ────────────────────────────────────────────────────────────
  ipcMain.handle('paybills:getAll', async () => {
    const db = getDb();
    return db.prepare(`SELECT pb.*, v.vendor_name FROM pay_bills pb LEFT JOIN vendors v ON v.id = pb.vendor_id ORDER BY pb.created_at DESC`).all();
  });

  ipcMain.handle('paybills:create', async (_, data) => {
    const db = getDb();
    const payingAmount = data.paying_amount || 0;
    const paymentDate = data.payment_date || data.last_payment_date || new Date().toISOString().slice(0, 10);
    db.prepare(`INSERT INTO pay_bills (vendor_id,purchase_invoice_id,outstanding_amount,total_payable,last_payment_date,payment_mode,due_date,paying_amount,payment_status) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(data.vendor_id, data.purchase_invoice_id || null, data.outstanding_amount || 0, data.total_payable || payingAmount, paymentDate, data.payment_mode || 'Cash', data.due_date || null, payingAmount, 'Paid');
    if (data.purchase_invoice_id) {
      db.prepare(`UPDATE purchase_invoices SET paid_amount = paid_amount + ?, pending_amount = pending_amount - ?, status = CASE WHEN paid_amount + ? >= grand_total THEN 'Received' ELSE 'Partial' END WHERE id = ?`)
        .run(payingAmount, payingAmount, payingAmount, data.purchase_invoice_id);
    }
    return { success: true };
  });

  // ─── BANKING ──────────────────────────────────────────────────────────────
  ipcMain.handle('banking:getAccounts', async () => {
    const db = getDb();
    return db.prepare(`SELECT * FROM accounts WHERE account_type IN ('Cash','Bank') AND is_active = 1`).all();
  });

  ipcMain.handle('banking:getTransactions', async () => {
    const db = getDb();
    return db.prepare(`SELECT * FROM banking_transactions ORDER BY date DESC LIMIT 50`).all();
  });

  ipcMain.handle('banking:addTransaction', async (_, data) => {
    const db = getDb();
    const year = new Date().getFullYear().toString().slice(-2);
    const last = db.prepare(`SELECT txn_id FROM banking_transactions ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (last) { const n = parseInt(last.txn_id.replace(`TXN-${year}`, ''), 10); seq = isNaN(n) ? 1 : n + 1; }
    const txn_id = `TXN-${year}${String(seq).padStart(3, '0')}`;
    db.prepare(`INSERT INTO banking_transactions (txn_id,account_id,account_name,date,description,type,amount) VALUES (?,?,?,?,?,?,?)`)
      .run(txn_id, data.account_id, data.account_name, data.date, data.description, data.type, data.amount);
    const delta = data.type === 'Credit' ? data.amount : -data.amount;
    db.prepare(`UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`).run(delta, data.account_id);
    return { success: true, txn_id };
  });

  // ─── EXPENSES ─────────────────────────────────────────────────────────────
  ipcMain.handle('expenses:getAll', async () => {
    const db = getDb();
    return db.prepare(`SELECT * FROM expenses ORDER BY expense_date DESC`).all();
  });

  ipcMain.handle('expenses:getStats', async () => {
    const db = getDb();
    const month = new Date().toISOString().slice(0, 7);
    const total = db.prepare(`SELECT COALESCE(SUM(amount),0) as val FROM expenses WHERE expense_date LIKE ?`).get(`${month}%`).val;
    const byCategory = db.prepare(`SELECT category, COALESCE(SUM(amount),0) as total FROM expenses WHERE expense_date LIKE ? GROUP BY category`).all(`${month}%`);
    return { total, byCategory };
  });

  ipcMain.handle('expenses:create', async (_, data) => {
    const db = getDb();
    const year = new Date().getFullYear().toString().slice(-2);
    const last = db.prepare(`SELECT expense_id FROM expenses ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (last) { const n = parseInt((last.expense_id || '').replace(`EXP-${year}`, ''), 10); seq = isNaN(n) ? 1 : n + 1; }
    const expense_id = `EXP-${year}${String(seq).padStart(3, '0')}`;
    db.prepare(`INSERT INTO expenses (expense_id,title,amount,expense_date,category,account_id,paid_from) VALUES (?,?,?,?,?,?,?)`)
      .run(expense_id, data.title, data.amount, data.expense_date, data.category, data.account_id, data.paid_from);
    if (data.account_id) db.prepare(`UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`).run(data.amount, data.account_id);
    return { success: true, expense_id };
  });

  // ─── REPORTS ──────────────────────────────────────────────────────────────
  ipcMain.handle('reports:sales', async (_, { from, to }) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT i.invoice_date as date, i.invoice_no as bill_no, i.customer_name,
             ii.product_name as item_name, ii.qty, ii.rate, ii.amount,
             i.status as payment_status, i.payment_mode,
             (ii.qty * (ii.rate - p.purchase_price)) as profit
      FROM invoices i JOIN invoice_items ii ON ii.invoice_id = i.id
      LEFT JOIN products p ON p.id = ii.product_id
      WHERE i.status != 'Draft' AND i.invoice_date BETWEEN ? AND ?
      ORDER BY i.invoice_date DESC
    `).all(from, to);
    return rows;
  });

  ipcMain.handle('reports:stock', async () => {
    const db = getDb();
    return db.prepare(`
      SELECT p.name as item_name, c.name as category, p.opening_stock,
             COALESCE((SELECT SUM(qty) FROM purchase_invoice_items WHERE product_id = p.id),0) as purchase_qty,
             COALESCE((SELECT SUM(qty) FROM invoice_items WHERE product_id = p.id),0) as sales_qty,
             p.current_stock, p.purchase_price, p.selling_price,
             ROUND(((p.selling_price - p.purchase_price) / NULLIF(p.selling_price,0)) * 100, 2) as profit_margin
      FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.is_active = 1
    `).all();
  });

  ipcMain.handle('reports:customerOutstanding', async () => {
    const db = getDb();
    return db.prepare(`
      SELECT customer_name, invoice_no, invoice_date, grand_total as total_amount,
             paid_amount, (grand_total - paid_amount) as balance
      FROM invoices WHERE is_credit_sale = 1 AND status != 'Draft' ORDER BY invoice_date DESC
    `).all();
  });

  ipcMain.handle('reports:vendorOutstanding', async () => {
    const db = getDb();
    return db.prepare(`
      SELECT v.vendor_name, pi.po_number as bill_no, pi.purchase_date as bill_date,
             pi.grand_total as total_amount, pi.paid_amount,
             (pi.grand_total - pi.paid_amount) as balance
      FROM purchase_invoices pi JOIN vendors v ON v.id = pi.vendor_id
      WHERE pi.status != 'Received' ORDER BY pi.purchase_date DESC
    `).all();
  });

  ipcMain.handle('reports:profitLoss', async (_, { from, to }) => {
    const db = getDb();
    return db.prepare(`
      SELECT ii.product_name as product,
             SUM(ii.qty) as units_sold, p.purchase_price as cost_price,
             p.selling_price as sales_price,
             SUM(ii.qty * (ii.rate - p.purchase_price)) as total_profit,
             ROUND(((p.selling_price - p.purchase_price) / NULLIF(p.selling_price,0)) * 100, 2) as margin
      FROM invoice_items ii JOIN products p ON p.id = ii.product_id
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE i.status != 'Draft' AND i.invoice_date BETWEEN ? AND ?
      GROUP BY ii.product_name ORDER BY total_profit DESC
    `).all(from, to);
  });

  ipcMain.handle('reports:balanceSheet', async () => {
    const db = getDb();
    const cashAccounts = db.prepare(`SELECT account_name, current_balance, is_primary FROM accounts WHERE account_type IN ('Cash','Bank') AND is_active=1`).all();
    const closingStock = db.prepare(`SELECT COALESCE(SUM(current_stock*purchase_price),0) as val FROM products WHERE is_active=1`).get().val;
    const customerOutstanding = db.prepare(`SELECT COALESCE(SUM(grand_total-paid_amount),0) as val FROM invoices WHERE is_credit_sale=1`).get().val;
    const vendorOutstanding = db.prepare(`SELECT COALESCE(SUM(grand_total-paid_amount),0) as val FROM purchase_invoices WHERE status != 'Received'`).get().val;
    const ownerCapital = db.prepare(`SELECT COALESCE(SUM(opening_balance),0) as val FROM accounts WHERE account_type='Capital'`).get().val;
    const totalRevenue = db.prepare(`SELECT COALESCE(SUM(grand_total),0) as val FROM invoices WHERE status!='Draft'`).get().val;
    const totalCost = db.prepare(`SELECT COALESCE(SUM(grand_total),0) as val FROM purchase_invoices WHERE status!='Pending'`).get().val;
    const totalExpenses = db.prepare(`SELECT COALESCE(SUM(amount),0) as val FROM expenses`).get().val;
    const retainedEarnings = totalRevenue - totalCost - totalExpenses;
    return { cashAccounts, closingStock, customerOutstanding, vendorOutstanding, ownerCapital, retainedEarnings };
  });

  // ─── GLOBAL SEARCH ────────────────────────────────────────────────────────
  ipcMain.handle('search:global', async (_, { query }) => {
    const db = getDb();
    const q = `%${query}%`;
    const invoices = db.prepare(`SELECT 'invoice' as type, id, invoice_no, customer_name, grand_total, status, invoice_date as date FROM invoices WHERE invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? LIMIT 5`).all(q, q, q);
    const products = db.prepare(`SELECT 'product' as type, id, sku, name, current_stock, selling_price, status FROM products WHERE name LIKE ? OR sku LIKE ? OR barcode LIKE ? AND is_active=1 LIMIT 5`).all(q, q, q);
    const vendors = db.prepare(`SELECT 'vendor' as type, id, vendor_name as name, company_name, phone FROM vendors WHERE vendor_name LIKE ? OR company_name LIKE ? LIMIT 3`).all(q, q);
    const users = db.prepare(`SELECT 'user' as type, id, name, mobile, role, is_active FROM users WHERE name LIKE ? OR mobile LIKE ? LIMIT 3`).all(q, q);
    const expenses = db.prepare(`SELECT 'expense' as type, id, expense_id, title as name, amount, expense_date as date FROM expenses WHERE title LIKE ? OR expense_id LIKE ? LIMIT 3`).all(q, q);
    return { invoices, products, vendors, users, expenses };
  });

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  ipcMain.handle('settings:getCompany', async () => getDb().prepare(`SELECT * FROM company_profile WHERE id=1`).get());
  ipcMain.handle('settings:saveCompany', async (_, data) => {
    getDb().prepare(`UPDATE company_profile SET company_name=?,mobile=?,email=?,address=? WHERE id=1`).run(data.company_name, data.mobile, data.email, data.address);
    return { success: true };
  });

  ipcMain.handle('accounts:getAll', async () => getDb().prepare(`SELECT * FROM accounts ORDER BY created_at`).all());
  ipcMain.handle('accounts:create', async (_, data) => {
    const db = getDb();
    db.prepare(`INSERT INTO accounts (account_name,account_type,opening_balance,current_balance,as_of_date) VALUES (?,?,?,?,?)`)
      .run(data.account_name, data.account_type, data.opening_balance, data.opening_balance, data.as_of_date);
    return { success: true };
  });
  ipcMain.handle('accounts:update', async (_, { id, ...data }) => {
    getDb().prepare(`UPDATE accounts SET account_name=?,account_type=?,opening_balance=? WHERE id=?`).run(data.account_name, data.account_type, data.opening_balance, id);
    return { success: true };
  });

  ipcMain.handle('users:getAll', async () => {
    const users = getDb().prepare(`SELECT id,name,mobile,email,role,is_active,avatar_path,created_at FROM users ORDER BY created_at`).all();
    return users;
  });
  ipcMain.handle('users:create', async (_, data) => {
    const hash = bcrypt.hashSync(data.password, 10);
    getDb().prepare(`INSERT INTO users (name,mobile,email,password,role) VALUES (?,?,?,?,?)`).run(data.name, data.mobile, data.email, hash, data.role);
    return { success: true };
  });
  ipcMain.handle('users:update', async (_, { id, ...data }) => {
    const db = getDb();
    if (data.password) {
      const hash = bcrypt.hashSync(data.password, 10);
      db.prepare(`UPDATE users SET name=?,mobile=?,email=?,role=?,password=? WHERE id=?`).run(data.name, data.mobile, data.email, data.role, hash, id);
    } else {
      db.prepare(`UPDATE users SET name=?,mobile=?,email=?,role=? WHERE id=?`).run(data.name, data.mobile, data.email, data.role, id);
    }
    return { success: true };
  });
  ipcMain.handle('users:toggleActive', async (_, { id, is_active }) => {
    getDb().prepare(`UPDATE users SET is_active=? WHERE id=?`).run(is_active, id);
    return { success: true };
  });
  ipcMain.handle('users:delete', async (_, { id }) => {
    getDb().prepare(`DELETE FROM users WHERE id=?`).run(id);
    return { success: true };
  });

  ipcMain.handle('branches:getAll', async () => getDb().prepare(`SELECT * FROM branches WHERE is_active=1`).all());

  // ─── BACKUP ───────────────────────────────────────────────────────────────
  ipcMain.handle('backup:getLogs', async () => getDb().prepare(`SELECT * FROM backups ORDER BY id DESC LIMIT 20`).all());
  ipcMain.handle('backup:now', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO backups (type,date_time,size_mb,status) VALUES ('Manual Backup (Admin)',?,0.0,'Success')`).run(now);
    return { success: true };
  });

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
  // Generate system notifications from live DB state (low stock, credit sales, overdue bills)
  function generateNotifications(db) {
    // Low/Critical stock alerts
    const lowStock = db.prepare(`SELECT id, name, current_stock, status FROM products WHERE status IN ('Low','Critical') AND is_active=1`).all();
    for (const p of lowStock) {
      const key = `stock-${p.id}`;
      const exists = db.prepare(`SELECT id FROM notifications WHERE type=? AND message LIKE ?`).get('low_stock', `%${p.name}%`);
      if (!exists) {
        db.prepare(`INSERT INTO notifications (type,title,message,link) VALUES (?,?,?,?)`)
          .run('low_stock',
            p.status === 'Critical' ? 'Critical Stock Alert' : 'Low Stock Alert',
            `${p.name} has only ${p.current_stock} unit(s) remaining`,
            '/inventory');
      }
    }

    // Unpaid credit invoices overdue by 3+ days
    const creditInvoices = db.prepare(`SELECT id, invoice_no, customer_name, grand_total, invoice_date FROM invoices WHERE is_credit_sale=1 AND status='Credit' AND date(invoice_date) <= date('now','-3 days')`).all();
    for (const inv of creditInvoices) {
      const exists = db.prepare(`SELECT id FROM notifications WHERE type='credit_due' AND message LIKE ?`).get(`%${inv.invoice_no}%`);
      if (!exists) {
        db.prepare(`INSERT INTO notifications (type,title,message,link) VALUES (?,?,?,?)`)
          .run('credit_due', 'Payment Overdue',
            `Invoice ${inv.invoice_no} from ${inv.customer_name} (₹${inv.grand_total}) is past due`,
            '/billing');
      }
    }

    // Pending purchase invoices with due date passed
    const overdueBills = db.prepare(`SELECT id, po_number, vendor_name, grand_total FROM purchase_invoices WHERE status NOT IN ('Received','Paid') AND due_date IS NOT NULL AND date(due_date) < date('now')`).all();
    for (const bill of overdueBills) {
      const exists = db.prepare(`SELECT id FROM notifications WHERE type='bill_due' AND message LIKE ?`).get(`%${bill.po_number}%`);
      if (!exists) {
        db.prepare(`INSERT INTO notifications (type,title,message,link) VALUES (?,?,?,?)`)
          .run('bill_due', 'Bill Payment Due',
            `Purchase ${bill.po_number} from ${bill.vendor_name} (₹${bill.grand_total}) is overdue`,
            '/vendors');
      }
    }
  }

  ipcMain.handle('notifications:getAll', async () => {
    const db = getDb();
    generateNotifications(db);
    const notifications = db.prepare(`SELECT * FROM notifications ORDER BY is_read ASC, created_at DESC LIMIT 50`).all();
    const unread = db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE is_read=0`).get().count;
    return { notifications, unread };
  });

  ipcMain.handle('notifications:markRead', async (_, { id } = {}) => {
    const db = getDb();
    if (id) {
      db.prepare(`UPDATE notifications SET is_read=1 WHERE id=?`).run(id);
    } else {
      db.prepare(`UPDATE notifications SET is_read=1`).run();
    }
    return { success: true };
  });

  ipcMain.handle('notifications:delete', async (_, { id } = {}) => {
    const db = getDb();
    if (id) {
      db.prepare(`DELETE FROM notifications WHERE id=?`).run(id);
    } else {
      db.prepare(`DELETE FROM notifications WHERE is_read=1`).run();
    }
    return { success: true };
  });

  ipcMain.handle('notifications:add', async (_, { type, title, message, link } = {}) => {
    const db = getDb();
    const r = db.prepare(`INSERT INTO notifications (type,title,message,link) VALUES (?,?,?,?)`).run(type, title, message, link || null);
    return { success: true, id: r.lastInsertRowid };
  });
};
