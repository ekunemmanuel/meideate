import "dotenv/config";
import { ExpoConfig, ConfigContext } from "expo/config";
import path from "path";
import dotenv from "dotenv";

// Load global .env file
dotenv.config({ path: path.join(__dirname, "../../.env") });

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || "Meideate",
  slug: config.slug || "meideate",
});
