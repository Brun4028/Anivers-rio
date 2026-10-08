/* ============================================================
   tools/serve.mjs — servidor local da experiência
   ------------------------------------------------------------
   Serve os arquivos do projeto por HTTP, sem dependências
   externas (apenas módulos nativos do Node).

   Uso:  npm run dev        (ou: node tools/serve.mjs)
   Abre: http://localhost:5173
   ============================================================ */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 5173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-cache" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";

    // resolve o caminho e impede saída da pasta do projeto
    const filePath = path.join(ROOT, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ""));
    if (!filePath.startsWith(ROOT)) return send(res, 403, "Acesso negado.");

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return send(res, 404, "Não encontrado: " + pathname);
    }

    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, fs.readFileSync(filePath), MIME[ext] || "application/octet-stream");
  } catch (err) {
    send(res, 500, "Erro interno: " + err.message);
  }
});

let port = PORT;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.warn("Porta " + port + " já está em uso, tentando " + (port + 1) + "…");
    port += 1;
    server.listen(port);
  } else {
    console.error(err);
    process.exit(1);
  }
});

server.listen(port, () => {
  console.log("ISADORA'S NOTE rodando em  http://localhost:" + port);
  console.log("Pressione Ctrl+C para encerrar.");
});
