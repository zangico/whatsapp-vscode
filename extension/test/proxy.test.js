const test = require('node:test');
const assert = require('node:assert');
const { buildProxyUrl } = require('../src/proxyUrl');
const { rerouteWhatsAppTraffic } = require('../src/patch');

test('buildProxyUrl maps settings to proxy URLs', () => {
    assert.strictEqual(buildProxyUrl({ type: 'none' }), null);
    assert.strictEqual(buildProxyUrl({}), null);
    assert.strictEqual(buildProxyUrl({ type: 'socks5', host: '127.0.0.1', port: 1080 }), 'socks5h://127.0.0.1:1080');
    assert.strictEqual(buildProxyUrl({ type: 'socks4', host: 'proxy.lan', port: 1080 }), 'socks4a://proxy.lan:1080');
    assert.strictEqual(buildProxyUrl({ type: 'http', host: ' proxy.lan ', port: 3128 }), 'http://proxy.lan:3128/');
    assert.strictEqual(buildProxyUrl({ type: 'https', host: '[::1]', port: 443 }), 'https://[::1]/');
    assert.strictEqual(
        buildProxyUrl({ type: 'http', host: 'proxy.lan', port: 8080, username: 'me@x' }, 'p:ss/word'),
        'http://me%40x:p%3Ass%2Fword@proxy.lan:8080/'
    );
});

test('buildProxyUrl rejects invalid settings', () => {
    assert.throws(() => buildProxyUrl({ type: 'ftp', host: 'a', port: 1 }), /Unknown proxy type/);
    assert.throws(() => buildProxyUrl({ type: 'http', host: '', port: 80 }), /Invalid proxy host/);
    assert.throws(() => buildProxyUrl({ type: 'http', host: 'evil.com/x@a', port: 80 }), /Invalid proxy host/);
    assert.throws(() => buildProxyUrl({ type: 'http', host: '::1', port: 80 }), /Invalid proxy host/);
    assert.throws(() => buildProxyUrl({ type: 'http', host: 'a', port: null }), /port/);
    assert.throws(() => buildProxyUrl({ type: 'http', host: 'a', port: 70000 }), /port/);
});

test('rerouteWhatsAppTraffic sends WhatsApp connections to the local server', () => {
    const opened = [];
    const fetched = [];
    const requested = [];
    class XMLHttpRequest { open(method, url) { requested.push([method, url]); } }
    const scope = {
        location: { host: 'localhost:49153' },
        WebSocket: class { constructor(url) { opened.push(url); } },
        XMLHttpRequest,
        fetch(url) { fetched.push(url); },
    };
    rerouteWhatsAppTraffic(scope);
    rerouteWhatsAppTraffic(scope); // second call must not wrap twice

    new scope.WebSocket('wss://web.whatsapp.com/ws/chat', 'binary');
    new scope.WebSocket('wss://example.com/socket');
    scope.fetch('https://web.whatsapp.com/ajax/x?a=1');
    scope.fetch(new URL('https://static.whatsapp.net/rsrc.php/a.js'));
    new scope.XMLHttpRequest().open('POST', 'https://web.whatsapp.com/ajax/bootloader-endpoint/?x=1', true);
    new scope.XMLHttpRequest().open('GET', '/relative');

    assert.deepStrictEqual(opened, ['ws://localhost:49153/ws/chat', 'wss://example.com/socket']);
    assert.deepStrictEqual(fetched, ['http://localhost:49153/ajax/x?a=1', 'https://static.whatsapp.net/rsrc.php/a.js']);
    assert.deepStrictEqual(requested, [['POST', 'http://localhost:49153/ajax/bootloader-endpoint/?x=1'], ['GET', '/relative']]);
});
