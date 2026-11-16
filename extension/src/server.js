// Local reverse proxy for WhatsApp Web. Runs as a child process of the extension
// (see extension.js), receives its configuration over IPC ({ proxyUrl, port }) and answers
// { ready: <port> } once a server answers on that port, or { error } when no port is usable.
const http = require('http');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { PATCH } = require('./patch');

const HOST = '127.0.0.1';
const PORT_ATTEMPTS = 10;
const PING_PATH = '/__whatsapp-vscode/ping';
const PING_REPLY = 'whatsapp-vscode';
const UPSTREAM = 'https://web.whatsapp.com';
const ORIGIN = 'https://web.whatsapp.com';
// Without a browser-like user agent and fetch metadata WhatsApp answers with an error page.
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
// Headers WhatsApp must not send to the browser: they block framing, or the rerouted connections to localhost.
const STRIPPED_HEADERS = [
    'x-frame-options',
    'content-security-policy',
    'content-security-policy-report-only',
    'cross-origin-embedder-policy',
    'cross-origin-opener-policy',
];

function createAgent(proxyUrl) {
    if (!proxyUrl) return undefined;
    const url = new URL(proxyUrl);
    if (url.protocol === 'http:' || url.protocol === 'https:') return new HttpsProxyAgent(url);
    if (url.protocol.startsWith('socks')) return new SocksProxyAgent(url);
    throw new Error(`Unsupported proxy protocol: ${url.protocol}`);
}

function describe(proxyUrl) {
    if (!proxyUrl) return 'direct connection';
    const url = new URL(proxyUrl);
    return `${url.protocol}//${url.host}${url.username ? ' (with credentials)' : ''}`;
}

function createServer(proxyUrl) {
    const agent = createAgent(proxyUrl);

    // Headers go in through options: proxy agents connect asynchronously, so onProxyReq would fire after they are sent.
    const proxy = createProxyMiddleware({
        target: UPSTREAM,
        changeOrigin: true,
        ws: true,
        agent,
        headers: {
            origin: ORIGIN,
            referer: `${ORIGIN}/`,
            'user-agent': USER_AGENT,
            'sec-fetch-site': 'same-origin',
            // The browser also offers zstd, which responseInterceptor cannot decode.
            'accept-encoding': 'gzip, deflate, br',
        },
        logLevel: 'warn',
        selfHandleResponse: true,
        onProxyRes: responseInterceptor(async (buffer, proxyRes, req, res) => {
            for (const header of STRIPPED_HEADERS) res.removeHeader(header);
            // localhost rejects cookies that name the WhatsApp domain.
            const cookies = proxyRes.headers['set-cookie'];
            if (cookies) res.setHeader('set-cookie', cookies.map((cookie) => cookie.replace(/;\s*Domain=[^;]*/i, '')));
            // Keep redirects on the local server.
            const location = proxyRes.headers.location;
            if (location) res.setHeader('location', location.replace(ORIGIN, ''));
            const type = proxyRes.headers['content-type'] || '';
            const isScript = /javascript/.test(type);
            const isHtml = /text\/html/.test(type);
            if (!(isScript || isHtml) || proxyRes.statusCode !== 200) return buffer;
            res.removeHeader('etag');
            res.removeHeader('last-modified');
            if (isScript) return Buffer.concat([Buffer.from(PATCH), buffer]);
            // The page scripts come straight from static.whatsapp.net, so the patch goes into the page itself.
            return Buffer.from(buffer.toString().replace(/<head[^>]*>/i, (head) => `${head}<script>${PATCH}</script>`));
        }),
    });

    const server = http.createServer((req, res) => {
        if (req.url === PING_PATH) return res.end(PING_REPLY);
        // Always get a full body back, so cached copies made before patching are never revalidated as-is.
        delete req.headers['if-none-match'];
        delete req.headers['if-modified-since'];
        proxy(req, res, () => {
            res.statusCode = 404;
            res.end();
        });
    });
    server.on('upgrade', proxy.upgrade);
    return server;
}

// Resolves true once listening, false if the port is taken (EADDRINUSE) or reserved by the OS (EACCES).
function listenOn(server, port) {
    return new Promise((resolve) => {
        const onError = (error) => {
            if (error.code !== 'EADDRINUSE' && error.code !== 'EACCES') {
                console.error(`Server error: ${error.message}`);
                process.exit(1);
            }
            resolve(false);
        };
        server.once('error', onError);
        server.listen(port, HOST, () => {
            server.off('error', onError);
            resolve(true);
        });
    });
}

// True when the port is held by this extension's server from another VS Code window.
function isOurServer(port) {
    return new Promise((resolve) => {
        const req = http.get({ host: HOST, port, path: PING_PATH, timeout: 1000 }, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => resolve(body === PING_REPLY));
        });
        req.on('timeout', () => req.destroy());
        req.on('error', () => resolve(false));
    });
}

// Tries basePort, then the next ports. Each port is its own origin, so WhatsApp keeps a separate login per port.
async function bind(server, basePort, proxyUrl) {
    for (let port = basePort; port < basePort + PORT_ATTEMPTS && port <= 65535; port++) {
        if (await listenOn(server, port)) {
            console.log(`Listening on http://${HOST}:${port} via ${describe(proxyUrl)}`);
            process.send?.({ ready: port });
            return;
        }
        if (await isOurServer(port)) {
            console.log(`Port ${port} is served by another VS Code window; taking over when it is released`);
            process.send?.({ ready: port });
            setTimeout(() => takeOver(server, port, basePort, proxyUrl), 2000);
            return;
        }
        console.log(`Port ${port} is used by another program, trying the next one`);
    }
    const error = `No usable port between ${basePort} and ${basePort + PORT_ATTEMPTS - 1}`;
    console.error(error);
    process.send?.({ error });
}

async function takeOver(server, port, basePort, proxyUrl) {
    if (await listenOn(server, port)) {
        console.log(`Took over http://${HOST}:${port} via ${describe(proxyUrl)}`);
    } else if (await isOurServer(port)) {
        setTimeout(() => takeOver(server, port, basePort, proxyUrl), 2000);
    } else {
        // The other window closed and another program grabbed the port: pick a port again.
        await bind(server, basePort, proxyUrl);
    }
}

process.once('message', ({ proxyUrl, port }) => {
    const fail = (error) => {
        console.error(`Cannot start server: ${error.message}`);
        process.exit(1);
    };
    try {
        bind(createServer(proxyUrl), port, proxyUrl).catch(fail);
    } catch (error) {
        fail(error);
    }
});
// The extension host went away: do not outlive it.
process.on('disconnect', () => process.exit(0));
