import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 로컬: Vite만 쓸 때 API는 vercel dev(기본 3000)로 띄우고 프록시로 붙입니다.
// 한 터미널에서 모두 쓰려면 `npx vercel dev`를 권장합니다.
const apiProxy = process.env.VITE_API_PROXY || "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: apiProxy,
        changeOrigin: true,
      },
    },
  },
});
