/**
 * Applies the schema and seeds reference data plus the walkthrough scenario.
 *   node scripts/db-setup.ts          migrate; seed only an empty database
 *   node scripts/db-setup.ts --reset  wipe and re-seed
 */
import { bootstrap } from "../src/server/seed.ts";
import { pool } from "../src/server/db.ts";

const force = process.argv.includes("--reset");
for (let attempt = 1; ; attempt++) {
  try {
    const result = await bootstrap({ force });
    console.log(
      result.seeded
        ? "Database seeded."
        : "Database already seeded; schema is current.",
    );
    break;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (
      attempt < 20 &&
      (code === "ECONNREFUSED" || code === "57P03" || code === "ENOTFOUND")
    ) {
      console.log(`Waiting for database (${code})...`);
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    throw error;
  }
}
await pool().end();
