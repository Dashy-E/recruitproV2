// HTTPS server for the live deployment.
//
// Serves the Next.js app over HTTPS using the certificate files in ./certs:
//   certs/key.pem   - private key                     (required)
//   certs/cert.pem  - certificate                     (required)
//   certs/ca.pem    - CA bundle / intermediate chain  (optional, add if your CA provided one)
//
// One port (default 3000) accepts both protocols:
//   https://host:3000/...  -> the app
//   http://host:3000/...   -> 301 redirect to https://host:3000/...
//
// Env vars (in .env or the shell):
//   PORT          port for the app, HTTPS + HTTP redirect (default 3000)
//   HTTP_PORT     optional extra plain-HTTP port that only redirects, e.g. 80 (default 0 = off)
//   SSL_KEY_PATH, SSL_CERT_PATH, SSL_CA_PATH  override the certificate file locations
//
// Usage:  npm run build  &&  npm run start:https

const https = require("https");
const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");
const next = require("next");

const dev = process.env.NODE_ENV === "development";
if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";

// Load .env now: Next.js only loads it inside app.prepare(), which is too late
// for the port/certificate settings read below.
require("@next/env").loadEnvConfig(__dirname, dev);

const PORT = parseInt(process.env.PORT || "3000", 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "0", 10);

const certDir = path.join(__dirname, "certs");
const keyPath = process.env.SSL_KEY_PATH || path.join(certDir, "private.key");
const certPath = process.env.SSL_CERT_PATH || path.join(certDir, "certificate.crt");
const caPath = process.env.SSL_CA_PATH || path.join(certDir, "ca_bundle.crt");

function readRequired(file, label) {
  if (!fs.existsSync(file)) {
    console.error(`[ssl] Missing ${label}: ${file}`);
    console.error("[ssl] Place your certificate files in the certs/ folder (see header of server.js).");
    process.exit(1);
  }
  return fs.readFileSync(file);
}

function loadCerts() {
  const opts = {
    key: readRequired(keyPath, "private key"),
    cert: readRequired(certPath, "certificate"),
  };
  if (fs.existsSync(caPath)) opts.ca = fs.readFileSync(caPath);
  return opts;
}

function listenErrorHandler(port, label) {
  return (err) => {
    if (err.code === "EACCES") {
      console.error(`[ssl] No permission to bind ${label} port ${port}. Ports below 1024 need: sudo setcap 'cap_net_bind_service=+ep' $(which node)`);
    } else if (err.code === "EADDRINUSE") {
      console.error(`[ssl] ${label} port ${port} is already in use (another app instance, "npm start", Nginx/Apache?).`);
    } else {
      console.error(`[ssl] ${label} server error:`, err);
    }
    process.exit(1);
  };
}

const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const httpsServer = https.createServer(
      { ...loadCerts(), minVersion: "TLSv1.2" },
      (req, res) => handle(req, res)
    );

    // Same-port redirect: the Host header already carries ":3000", keep it as-is.
    const samePortRedirect = http.createServer((req, res) => {
      res.writeHead(301, { Location: `https://${req.headers.host || ""}${req.url}` });
      res.end();
    });

    // Every TLS connection starts with byte 0x16 (handshake). Anything else is
    // plain HTTP, so send it to the redirect server instead.
    const mainServer = net.createServer((socket) => {
      socket.on("error", () => socket.destroy());
      socket.setTimeout(30000, () => socket.destroy());
      socket.once("data", (chunk) => {
        socket.setTimeout(0);
        socket.pause();
        socket.unshift(chunk);
        const target = chunk[0] === 0x16 ? httpsServer : samePortRedirect;
        target.emit("connection", socket);
        process.nextTick(() => socket.resume());
      });
    });

    mainServer.on("error", listenErrorHandler(PORT, "Main"));
    mainServer.listen(PORT, () => {
      console.log(`> Ready on https://localhost:${PORT}  (http:// on the same port redirects to https)`);
    });

    // Optional extra redirect port, e.g. HTTP_PORT=80 so http://host (no port) also works.
    if (HTTP_PORT > 0 && HTTP_PORT !== PORT) {
      const portSuffix = PORT === 443 ? "" : `:${PORT}`;
      const extraRedirect = http.createServer((req, res) => {
        const host = (req.headers.host || "").split(":")[0];
        res.writeHead(301, { Location: `https://${host}${portSuffix}${req.url}` });
        res.end();
      });
      extraRedirect.on("error", (err) => {
        // Convenience only — don't take the app down if this port is unavailable.
        console.warn(`[ssl] HTTP redirect on port ${HTTP_PORT} not started: ${err.code || err.message}`);
      });
      extraRedirect.listen(HTTP_PORT, () => {
        console.log(`> http://<host>:${HTTP_PORT} redirects to https on port ${PORT}`);
      });
    }

    // Reload certificate files without restarting (e.g. after renewal): kill -HUP <pid>
    process.on("SIGHUP", () => {
      try {
        httpsServer.setSecureContext(loadCerts());
        console.log("[ssl] Certificates reloaded.");
      } catch (err) {
        console.error("[ssl] Certificate reload failed, keeping the old ones:", err.message);
      }
    });
  })
  .catch((err) => {
    console.error("Failed to start Next.js:", err);
    process.exit(1);
  });
