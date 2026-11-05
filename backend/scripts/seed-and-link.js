import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dir = path.resolve(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const files = ['4f6297955562fa647a7ffb8b4b13b38cc5c1b683cc275e7168665524bde388ef.sqlite', '99a24e44553cf0a01296233d3e5d961ee76c57038bfb5e51548475ec1ef160d5.sqlite'];

for (const f of files) {
  const filePath = path.join(dir, f);
  const db = new DatabaseSync(filePath);
  
  // Ensure users Mohamed Imthiyaz and Rizwi Ahamed exist
  const u1 = db.prepare('SELECT id FROM users WHERE LOWER(name) = ?').get('mohamed imthiyaz');
  let u1Id = u1 ? u1.id : null;
  if (!u1Id) {
    u1Id = 'USR-MOHAMED-001';
    db.prepare(`INSERT INTO users (id, display_id, name, user_name, password, email, user_type, qr_token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(u1Id, 'USR-0006', 'Mohamed Imthiyaz', 'imthiyaz', '123456', 'm.imthiyaz@faaztechsolutions.com', 'Employee', 'qr_imthiyaz');
    db.prepare(`INSERT OR IGNORE INTO user_organizations (id, user_id, organization_id, role, created_at) VALUES (?, ?, ?, ?, datetime('now'))`)
      .run('uo_imthiyaz_cafe', u1Id, 'org_cafe_local', 'Employee');
  }

  const u2 = db.prepare('SELECT id FROM users WHERE LOWER(name) = ?').get('rizwi ahamed');
  let u2Id = u2 ? u2.id : null;
  if (!u2Id) {
    u2Id = 'USR-RIZWI-001';
    db.prepare(`INSERT INTO users (id, display_id, name, user_name, password, email, user_type, qr_token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(u2Id, 'USR-0007', 'Rizwi Ahamed', 'rizwi', '123456', 'rizwi@faaztechsolutions.com', 'Employee', 'qr_rizwi');
    db.prepare(`INSERT OR IGNORE INTO user_organizations (id, user_id, organization_id, role, created_at) VALUES (?, ?, ?, ?, datetime('now'))`)
      .run('uo_rizwi_cafe', u2Id, 'org_cafe_local', 'Employee');
  }

  // Update employee_id in orders
  db.prepare('UPDATE orders SET employee_id = ? WHERE employee_name = ? AND organization_id = ?').run(u1Id, 'Mohamed Imthiyaz', 'org_cafe_local');
  db.prepare('UPDATE orders SET employee_id = ? WHERE employee_name = ? AND organization_id = ?').run(u2Id, 'Rizwi Ahamed', 'org_cafe_local');

  // Assign them to seats in seats table
  db.prepare('UPDATE seats SET employee_id = ?, employee_name = ?, employee = ?, employee_email = ? WHERE id = ?').run(u1Id, 'Mohamed Imthiyaz', 'Mohamed Imthiyaz', 'm.imthiyaz@faaztechsolutions.com', 'ROOM-0001');
  db.prepare('UPDATE seats SET employee_id = ?, employee_name = ?, employee = ?, employee_email = ? WHERE id = ?').run(u2Id, 'Rizwi Ahamed', 'Rizwi Ahamed', 'rizwi@faaztechsolutions.com', 'OFFICE-0001');

  // Ensure employee_seat_assignments table has them
  try {
    db.prepare(`INSERT OR REPLACE INTO employee_seat_assignments (id, organization_id, location_id, seat_id, employee_id, assigned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`)
      .run('esa_room_001', 'org_cafe_local', 'loc_room_test_1793874966875', 'ROOM-0001', u1Id);
    db.prepare(`INSERT OR REPLACE INTO employee_seat_assignments (id, organization_id, location_id, seat_id, employee_id, assigned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`)
      .run('esa_office_001', 'org_cafe_local', '1792592302112', 'OFFICE-0001', u2Id);
  } catch (e) {
    console.log('esa error:', e.message);
  }

  // Ensure CAFE items exist
  const cafeItemCount = db.prepare('SELECT count(*) as c FROM items WHERE organization_id = ?').get('org_cafe_local');
  if (cafeItemCount.c === 0) {
    db.prepare(`INSERT INTO items (id, organization_id, name, type, category, preference, amount, status, created_at, updated_at) VALUES ('item_cafe_001', 'org_cafe_local', 'Vada', 'Snacks', 'Snacks', 'No', 10, 'Active', datetime('now'), datetime('now'))`).run();
    db.prepare(`INSERT INTO items (id, organization_id, name, type, category, preference, amount, status, created_at, updated_at) VALUES ('item_cafe_002', 'org_cafe_local', 'Coffee', 'Beverages', 'Beverages', 'Medium', 10, 'Active', datetime('now'), datetime('now'))`).run();
    db.prepare(`INSERT INTO items (id, organization_id, name, type, category, preference, amount, status, created_at, updated_at) VALUES ('item_cafe_003', 'org_cafe_local', 'Tea', 'Beverages', 'Beverages', 'Medium', 10, 'Active', datetime('now'), datetime('now'))`).run();
  }

  // Also populate items_json and order_items for existing CAFE orders if empty
  const cafeOrders = db.prepare('SELECT id, total FROM orders WHERE organization_id = ?').all('org_cafe_local');
  for (const o of cafeOrders) {
    const existingItems = db.prepare('SELECT count(*) as c FROM order_items WHERE order_id = ?').get(o.id);
    if (existingItems.c === 0) {
      if (o.id.includes('OFFICE')) {
        const items = [{ itemId: 'item_cafe_001', name: 'Vada', qty: 1, price: 10 }, { itemId: 'item_cafe_002', name: 'Coffee', qty: 1, price: 5, preference: 'Medium' }];
        db.prepare('UPDATE orders SET items_json = ? WHERE id = ?').run(JSON.stringify(items), o.id);
        db.prepare(`INSERT INTO order_items (id, order_id, organization_id, item_id, name, qty, unit_price, preference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
          .run('oi_' + o.id + '_1', o.id, 'org_cafe_local', 'item_cafe_001', 'Vada', 1, 10, null);
        db.prepare(`INSERT INTO order_items (id, order_id, organization_id, item_id, name, qty, unit_price, preference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
          .run('oi_' + o.id + '_2', o.id, 'org_cafe_local', 'item_cafe_002', 'Coffee', 1, 5, 'Medium');
      } else {
        const items = [{ itemId: 'item_cafe_001', name: 'Vada', qty: 1, price: 10 }, { itemId: 'item_cafe_003', name: 'Tea', qty: 1, price: 15, preference: 'Medium' }];
        db.prepare('UPDATE orders SET items_json = ? WHERE id = ?').run(JSON.stringify(items), o.id);
        db.prepare(`INSERT INTO order_items (id, order_id, organization_id, item_id, name, qty, unit_price, preference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
          .run('oi_' + o.id + '_1', o.id, 'org_cafe_local', 'item_cafe_001', 'Vada', 1, 10, null);
        db.prepare(`INSERT INTO order_items (id, order_id, organization_id, item_id, name, qty, unit_price, preference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
          .run('oi_' + o.id + '_2', o.id, 'org_cafe_local', 'item_cafe_003', 'Tea', 1, 15, 'Medium');
      }
    }
  }
}

console.log('Seed and link completed successfully.');

