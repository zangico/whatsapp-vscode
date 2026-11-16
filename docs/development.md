# Development

## Prerequisites

- Node.js 20 or newer (matches `@types/node` 20.x).
- VS Code 1.91 or newer (`engines.vscode: ^1.91.0`).
- npm.

The code is plain JavaScript (CommonJS) with no build step: what is in `extension/src/` is what ships.

## Setup

```sh
cd extension
npm ci
```

Runtime dependencies: `http-proxy-middleware` (2.x), `https-proxy-agent`, `socks-proxy-agent`. They are shipped in the `.vsix` (`node_modules/` is not in `.vscodeignore`; only `test/**` is excluded).

## Running in an Extension Development Host

```sh
code --extensionDevelopmentPath=<abs path>/extension
```

There is no `.vscode/launch.json` in the repository, so F5 is not preconfigured. If you add a launch config locally, use an `extensionHost` configuration with `--extensionDevelopmentPath=${workspaceFolder}/extension`.

Other VS Code windows running the extension do not need to be closed: if port `49153` is taken, the server in the new window shares the other window's server or falls back to the next port (see [configuration.md](configuration.md)). Each port has its own WhatsApp login.

## Tests

```sh
cd extension
npm test        # node --test
```

`extension/test/proxy.test.js` (node:test, no VS Code needed) covers:

- `buildProxyUrl`: type-to-scheme mapping (`socks5h`, `socks4a`, `http`, `https`), `none` and empty settings give `null`, host trimming, IPv6 in brackets, credential percent-encoding, rejection of unknown types, empty/injected/unbracketed hosts and bad ports.
- `rerouteWhatsAppTraffic`: `WebSocket`, `fetch` and `XMLHttpRequest.open` URLs for `web.whatsapp.com` are rewritten to the local host (same path), other URLs are untouched, and calling it twice does not wrap twice.

`extension/test/server.test.js` forks the real `server.js` with `{ proxyUrl: null, port }` on a random base port:

- A foreign HTTP server on the base port: the server replies `{ ready: base + 1 }`.
- A second instance with the same base port also replies `{ ready: base + 1 }` (shared port); after the first is killed, the second takes the port over within about 3 s.
- With all 10 candidate ports blocked, the server replies with `{ error }` ("No usable port ...").

These tests open loopback ports, so they need permission to listen on `127.0.0.1` (a sandbox that blocks listening makes them fail).

Not covered by tests: the proxying itself in `server.js`, `extension.js`, real proxies, VS Code integration. The listed devDependencies `@vscode/test-cli`, `@vscode/test-electron`, `eslint`, `typescript` and `@types/mocha` are installed but not used by any script or config in the repository.

## Running the server standalone

Useful to check proxy behaviour without VS Code. Save as a scratch file outside the repo (for example `run-server.js`):

```js
const { fork } = require('child_process');
const child = fork('<abs path>/extension/src/server.js', [], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});
child.on('message', (m) => console.log('message from server:', m));
// null = direct connection; or e.g. 'socks5h://127.0.0.1:1080'
child.send({ proxyUrl: null, port: 49153 });
```

The server answers with `{ ready: <port> }` (the port it actually uses, which may be above 49153) or `{ error }`. Run it with `node run-server.js`. The server exits when the IPC channel closes, so keep this process running. Then, from another terminal:

```sh
curl -i http://127.0.0.1:49153/                       # WhatsApp Web index with the patch, no X-Frame-Options
```

Send `-H 'accept: text/html' -H 'sec-fetch-dest: document' -H 'sec-fetch-mode: navigate'` with the first request: without browser-like headers WhatsApp may answer differently. The HTML starts with `<head><script>` followed by the patch text.

To confirm a proxy is used, point `proxyUrl` at it and watch its log; with an unreachable proxy the requests must fail (HTTP 500), not succeed directly.

## Debugging

- Output channel: View > Output, select **WhatsApp-VSCode**. It shows the server's stdout/stderr (listening line, port notices, proxy errors at `logLevel: 'warn'`) and "Server stopped (...)" on exit.
- Webview: Command Palette, **Developer: Open Webview Developer Tools** (use it with the WhatsApp view focused). Check the Console, the Network tab (rewritten requests to `localhost:49153/__tg/...`) and Application > Service Workers.
- Extension host log: **Developer: Show Logs...** > Extension Host.

## Packaging and publishing

```sh
cd extension
npx @vscode/vsce package      # produces whatsapp-vscode-<version>.vsix
npx @vscode/vsce publish      # needs a Marketplace token for publisher zangico
```

Install a local build with `code --install-extension whatsapp-vscode-<version>.vsix`. `*.vsix` is git-ignored.

## Release checklist

1. Bump `version` in `extension/package.json`.
2. Add release notes (`### x.y.z`) to `extension/README.md`.
3. Make sure `extension/package-lock.json` is up to date and committed (`npm install`, then commit).
4. `cd extension && npm ci && npm test`.
5. Smoke test in an Extension Development Host: sidebar loads, tab command works, proxy settings apply.
6. `npx @vscode/vsce package` and inspect the file list.
7. Commit, push to `master`, then tag and push the tag: `git tag v<version> && git push origin v<version>`.

Pushing a `v*` tag runs [`.github/workflows/publish.yml`](../.github/workflows/publish.yml). The workflow checks that the tag matches `version` in `package.json`, runs `npm ci` and `npm test`, then runs `vsce publish --oidc`. Publishing uses the Marketplace's Trusted Publishing, so no access token is stored in the repository. The `zangico` publisher has a Trusted Publishing policy that allows the `zangico/whatsapp-vscode` repository and the `publish.yml` workflow, and the `production` GitHub environment (the job declares `environment: production`). Protection rules for that environment, such as required reviewers or a `v*` tag filter, can be set under the repository's Settings > Environments. If the workflow file or the environment is renamed, or the repository moves, update that policy on the Marketplace publisher page, or publishing fails at the token exchange.

## Code conventions

- CommonJS (`require`/`module.exports`), plain JavaScript, no transpilation or bundler.
- 4-space indentation, single quotes, semicolons.
- `src/patch.js` must stay self-contained: `rerouteWhatsAppTraffic` is serialized with `Function.prototype.toString` (via template string) and runs in a browser scope, so it must not reference anything outside its own body.
- `src/proxyUrl.js` and `src/patch.js` do not import `vscode`, so they can be unit-tested with plain `node --test`.
- Comments explain why, not what.
- Errors in proxy configuration must fail closed (no server), never fall back to a direct connection.
