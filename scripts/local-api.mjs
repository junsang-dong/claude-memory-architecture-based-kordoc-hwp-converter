/**
 * vercel dev 없이 /api/convert 를 로컬에서 띄웁니다.
 * 실행: node --env-file=.env scripts/local-api.mjs
 */
import http from "node:http";
import handler from "../api/convert.js";

const PORT = Number(process.env.LOCAL_API_PORT || 3000);
const HOST = "127.0.0.1";

const server = http.createServer((req, res) => {
  const path = req.url?.split("?")[0] || "";

  if (path === "/api/convert" && req.method === "POST") {
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error(err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
    return;
  }

  if (path === "/api/convert" && req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Local API ready: http://${HOST}:${PORT}/api/convert`);
});
