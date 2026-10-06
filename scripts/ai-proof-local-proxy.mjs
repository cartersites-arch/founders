// Development only: route ordinary localhost URLs to the proof workspace.
// No deploy command or production credentials are used by this proxy.
import http from "node:http";

const upstreamPort = Number(process.env.PROOF_UPSTREAM_PORT || 8081);
const port = Number(process.env.PROOF_PROXY_PORT || 8082);
const workspaceHost = "founders-dev-preview.cartersites.workers.dev";

http
  .createServer((request, response) => {
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: upstreamPort,
        path: request.url,
        method: request.method,
        headers: { ...request.headers, "x-forwarded-host": workspaceHost },
      },
      (result) => {
        response.writeHead(result.statusCode, result.headers);
        result.pipe(response);
      },
    );
    upstream.on("error", () => {
      response.writeHead(502, { "Content-Type": "text/plain" });
      response.end("Proof development server is unavailable.");
    });
    request.pipe(upstream);
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Proof URLs: http://localhost:${port}/p/{slug}`);
  });
