import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "password123";

const DEMO_FLAGS = [
  { key: "new-checkout", description: "Redesigned checkout button", enabled: true, rollout: 20 },
  { key: "dark-mode", description: "Dark theme for the store", enabled: true, rollout: 100 },
  { key: "free-shipping-banner", description: "Free shipping promo banner", enabled: false, rollout: 50 },
];

async function seed() {
  await pool.query("DELETE FROM users WHERE email = $1", [DEMO_EMAIL]);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { rows: [user] } = await pool.query<{ id: string }>(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
    [DEMO_EMAIL, passwordHash],
  );

  const { rows: [project] } = await pool.query<{ id: string }>(
    "INSERT INTO projects (name, owner_id) VALUES ($1, $2) RETURNING id",
    ["Demo Store", user.id],
  );

  for (const flag of DEMO_FLAGS) {
    await pool.query(
      `INSERT INTO flags (project_id, key, description, enabled, rollout_percentage)
       VALUES ($1, $2, $3, $4, $5)`,
      [project.id, flag.key, flag.description, flag.enabled, flag.rollout],
    );
  }

  console.log(`seeded ${DEMO_EMAIL} / ${DEMO_PASSWORD} with ${DEMO_FLAGS.length} flags`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());