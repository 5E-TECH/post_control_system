import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true, // 👈 Barcha hostlarni ruxsat beradi
    headers: {
      "ngrok-skip-browser-warning": "any-value",
    }
  },
});