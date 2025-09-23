import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            "/tc": {
                target: "https://geohydroai.org",   // твій домен
                changeOrigin: true,
                secure: true,                       // якщо самопідписаний TLS, постав false
            }
        }
    }
})
