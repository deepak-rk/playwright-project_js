import * as http from 'http';
import type { AddressInfo } from 'net';

export interface FixtureArtifactServer {
  url: string;
  sizeBytes: number;
  close: () => Promise<void>;
}

/** Serves a small fixed-content "build artifact" over plain HTTP, for exercising the 'url' BuildProvider. */
export function startFixtureArtifactServer(): Promise<FixtureArtifactServer> {
  const body = Buffer.from('e2e-fake-apk-contents-'.repeat(50));
  return new Promise((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': body.length });
      res.end(body);
    });
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}/app.apk`,
        sizeBytes: body.length,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
