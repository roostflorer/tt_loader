import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

// Load server/.env (like server/index.ts does) BEFORE importing bot/storage/db
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

// Dynamically import the bot after env is loaded so db/storage sees DATABASE_URL
(async () => {
  try {
    const { startBot } = await import("./bot");
    await startBot();
    console.log("Telegram bot runner started.");
  } catch (err) {
    console.error("Failed to start Telegram bot runner:", err);
    process.exit(1);
  }
})();
