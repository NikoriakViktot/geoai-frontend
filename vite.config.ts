import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ command }) => {
    const isDev = command === "serve";

    return {
        plugins: [react()],

        // База: у dev можна залишити "/", у продакшні — підшлях
        base: isDev ? "/" : "/flood_scenarios/",

        // Проксі працює ТІЛЬКИ у dev (vite dev server)
        server: {
            proxy: {
                "/tc": {
                    target: "https://geohydroai.org",
                    changeOrigin: true,
                    secure: true, // якщо був би самопідписаний сертифікат — поставив би false
                    // pathRewrite не потрібен, шлях і так зберігаємо як /tc/...
                },
            },
        },
    };
});
