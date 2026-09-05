// Custom entry point for Hostinger's Node.js hosting, which requires a
// script that starts an HTTP server listening on process.env.PORT — `next
// start` (a CLI process) doesn't fit that shape, so this wraps Next.js's
// request handler in a plain http.Server instead. CommonJS deliberately
// (no "type": "module" in package.json): Hostinger's lsnode.js loads the
// entry file via require(), which cannot load an ESM module that uses
// top-level await.
const { createServer } = require("node:http");
const { parse } = require("node:url");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const app = next({ dev: false });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      handle(req, res, parse(req.url, true));
    }).listen(port, () => {
      console.log(`> Ready on port ${port}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
