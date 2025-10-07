import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(() => ({
    plugins: [react()],
    base: "/", // <= важливо
    server: {
        proxy: {
            "/tc": { target: "https://geohydroai.org", changeOrigin: true, secure: true }
        }
    }
}));
