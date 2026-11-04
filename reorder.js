const fs = require('fs');
let file = fs.readFileSync('backend/src/controllers/location.controller.ts', 'utf8');
const search = `      const number = rawNumber.padStart(2, "0");
      const displayId = \`SEAT-\${org.shortCode}-\${number}\`;
      const existingSeatRow = (await db.prepare(\`SELECT id, display_id FROM seats WHERE location_id = ? AND number = ?\`).bind(effectiveLocId, number).get()) as any;
      const seatId = existingSeatRow?.id || (await generateId(db, "SEA"));

      const db = getUniversalDb(c.env?.DB);

      // Verify location belongs to authorized organization
      const loc = (await db
        .prepare(\`SELECT id, organization_id as organizationId FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?\`)
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;`;

const replace = `      const number = rawNumber.padStart(2, "0");
      const displayId = \`SEAT-\${org.shortCode}-\${number}\`;

      const db = getUniversalDb(c.env?.DB);

      // Verify location belongs to authorized organization
      const loc = (await db
        .prepare(\`SELECT id, organization_id as organizationId FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?\`)
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;
      const existingSeatRow = (await db.prepare(\`SELECT id, display_id FROM seats WHERE location_id = ? AND number = ?\`).bind(effectiveLocId, number).get()) as any;
      const seatId = existingSeatRow?.id || (await generateId(db, "SEA"));`;

file = file.replace(search, replace);
fs.writeFileSync('backend/src/controllers/location.controller.ts', file, 'utf8');
console.log('Reordered successfully');

