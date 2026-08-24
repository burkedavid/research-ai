import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { THEME_DEFINITIONS } from "../../lib/seed/corpus";

const TEST_DB_URL = "postgres://postgres:postgres@localhost:5433/sentiment_hub_test";

/** Runs once per vitest invocation: clean schema, migrations, reference data.
 *  Named export because Playwright's globalSetup imports it too, and its TS
 *  loader wraps default exports differently to vitest's. */
export async function resetTestDatabase() {
  const client = postgres(TEST_DB_URL, { max: 1, prepare: false });
  const db = drizzle(client);

  await client`DROP SCHEMA public CASCADE`;
  await client`CREATE SCHEMA public`;
  await client`DROP SCHEMA IF EXISTS drizzle CASCADE`; // migrations journal, or migrate() no-ops
  await migrate(db, { migrationsFolder: "./db/migrations" });

  // reference data mirroring scripts/seed.ts (users, taxonomy, client/project)
  await client`
    INSERT INTO users (email, name, role, transcript_access) VALUES
      ('admin@example.com', 'Alex Admin', 'admin', true),
      ('researcher@example.com', 'Riley Researcher', 'researcher', true),
      ('summary-only@example.com', 'Sam Summary', 'researcher', false),
      ('viewer@example.com', 'Vic Viewer', 'viewer', false)
  `;
  const segments = [
    ["Rising Metropolitans", "Younger urban professionals"],
    ["Budgeting Elderly", "Retired, fixed incomes"],
    ["Stretched Families", "Working parents"],
    ["Comfortable Traditionalists", "Older, mortgage-free"],
    ["Young Strivers", "Early-career renters"],
    ["Prudent Professionals", "Mid-career savers"],
    // real report segments (item 3) that don't overlap the synthetic set above
    ["Still at Home", "Younger adults still at home"],
    ["Starting Out", "Early-career, often renting"],
    ["Constrained Parents", "Parents squeezed by childcare and costs"],
    ["Working Singles & Couples", "Working-age, no children"],
    ["Home-Owning Families", "Mortgaged families, school-age children"],
    ["High Income Professionals", "Higher earners, comfortable"],
    ["Older Working Families", "Established families, later working life"],
    ["Mid-Life Renters", "Mid-life renting households"],
    ["Asset Rich Greys", "Older, asset-rich, mortgage-free"],
    ["Road to Retirement", "Approaching retirement"],
  ];
  for (const [name, description] of segments) {
    await client`INSERT INTO segments (name, description) VALUES (${name}, ${description})`;
  }
  // definitions come from the same source the app seeds from, so tests exercise
  // the real taxonomy the tagger and reviewers actually see
  for (const theme of THEME_DEFINITIONS) {
    await client`INSERT INTO themes (name, definition) VALUES (${theme.name}, ${theme.definition})`;
  }
  const [clientRow] = await client`
    INSERT INTO clients (name, notes) VALUES ('Test Client', 'synthetic') RETURNING id
  `;
  await client`
    INSERT INTO projects (client_id, name, lawful_basis)
    VALUES (${clientRow.id}, 'Consumer Sentiment Monitor', 'synthetic test data')
  `;

  await client.end();
}

export default resetTestDatabase;
