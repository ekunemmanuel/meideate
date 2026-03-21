import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { tailwind } from "@meideate/ui/plugin";

// https://vite.dev/config/
// Configured with shared Tailwind plugin
export default defineConfig({
  // @ts-expect-error - ignoring version mismatch in tailwind plugin
  plugins: [vue(), tailwind()],
  envDir: "../..",
});
