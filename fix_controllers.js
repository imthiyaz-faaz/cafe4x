const fs = require('fs');
const path = require('path');

// 1. Fix location.controller.ts
const locPath = path.join(__dirname, 'backend', 'src', 'controllers', 'location.controller.ts');
let locStr = fs.readFileSync(locPath, 'utf8');

const targetLoc = `      const number = rawNumber.padStart(2, "0");
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

const replacementLoc = `      const db = getUniversalDb(c.env?.DB);

      // Verify location belongs to authorized organization
      const loc = (await db
        .prepare(\`SELECT id, organization_id as organizationId FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?\`)
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;
      const number = rawNumber.padStart(2, "0");
      const displayId = \`SEAT-\${org.shortCode}-\${number}\`;
      const existingSeatRow = (await db.prepare(\`SELECT id, display_id FROM seats WHERE location_id = ? AND number = ?\`).bind(effectiveLocId, number).get()) as any;
      const seatId = existingSeatRow?.id || (await generateId(db, "SEA"));`;

if (locStr.includes(targetLoc.replace(/\n/g, '\r\n'))) {
  locStr = locStr.replace(targetLoc.replace(/\n/g, '\r\n'), replacementLoc.replace(/\n/g, '\r\n'));
} else if (locStr.includes(targetLoc)) {
  locStr = locStr.replace(targetLoc, replacementLoc);
}
fs.writeFileSync(locPath, locStr, 'utf8');

// 2. Fix working-hours.controller.ts
const whPath = path.join(__dirname, 'backend', 'src', 'controllers', 'working-hours.controller.ts');
let whStr = fs.readFileSync(whPath, 'utf8');

whStr = whStr.replace(
  'import { getUniversalDb } from "../db";',
  'import { getUniversalDb } from "../db";\nimport { generateId } from "../utils/id-generator";'
);
fs.writeFileSync(whPath, whStr, 'utf8');
console.log('Fixed location and working-hours controllers');

