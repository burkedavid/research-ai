import { config as loadEnv } from "dotenv";

// Next.js loads .env.local itself; standalone tsx scripts must do it here,
// and this import must come before anything that touches lib/env.
loadEnv({ path: [".env.local", ".env"] });
