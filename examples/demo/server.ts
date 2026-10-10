// Local demo: `npm run demo`, then open http://localhost:5173.
// Serves the proxy handler at /api/address and a bundled React page at /.
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createAddressHandler } from "israel-address-autocomplete";

const handler = createAddressHandler();
const port = Number(process.env.PORT ?? 5173);
const root = fileURLToPath(new URL("../..", import.meta.url));

const bundle = await build({
  entryPoints: [fileURLToPath(new URL("./app.tsx", import.meta.url))],
  bundle: true,
  write: false,
  format: "esm",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  alias: {
    "israel-address-autocomplete/react": `${root}/src/react.tsx`,
  },
});
const js = bundle.outputFiles[0]!.text;
const html = `<!doctype html><html lang="he"><meta charset="utf-8"><title>Demo</title>
<div id="root"></div><script type="module" src="/app.js"></script></html>`;

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  if (url.pathname === "/api/address") {
    const r = await handler(new Request(url));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(await r.text());
  } else if (url.pathname === "/app.js") {
    res.writeHead(200, { "Content-Type": "text/javascript" }).end(js);
  } else {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html);
  }
}).listen(port, () => console.log(`demo on http://localhost:${port}`));
