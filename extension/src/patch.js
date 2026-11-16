// WhatsApp Web opens its chat WebSocket (wss://web.whatsapp.com/ws/chat) and sends XHR/fetch requests to
// absolute https://web.whatsapp.com URLs from the page and its workers. server.js injects this function into
// the HTML and prepends it to every script it serves, so those connections reach the local server and follow
// the configured proxy.
function rerouteWhatsAppTraffic(scope) {
    if (scope.__whatsappVscodeReroute) return;
    scope.__whatsappVscodeReroute = true;

    const remote = /^(wss|ws|https|http):\/\/web\.whatsapp\.com(?=[/?#]|$)/;
    const toLocal = (url) => {
        const match = remote.exec(url);
        if (!match) return url;
        const protocol = match[1].startsWith('ws') ? 'ws' : 'http';
        return `${protocol}://${scope.location.host}${url.slice(match[0].length)}`;
    };

    if (scope.WebSocket) {
        scope.WebSocket = new Proxy(scope.WebSocket, {
            construct: (Target, [url, ...rest]) => new Target(toLocal(String(url)), ...rest),
        });
    }
    if (scope.fetch) {
        const fetch = scope.fetch;
        scope.fetch = (input, init) => fetch.call(
            scope,
            typeof input === 'string' || input instanceof URL ? toLocal(String(input)) : input,
            init
        );
    }
    if (scope.XMLHttpRequest) {
        const open = scope.XMLHttpRequest.prototype.open;
        scope.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            return open.call(this, method, toLocal(String(url)), ...rest);
        };
    }
}

// Runs in the page only (inside the extension's webview iframe). The webview forwards these messages to
// the extension: unread chats from the document title, and notifications through a stand-in for the
// Notification API, so WhatsApp believes they are allowed.
function bridgeToExtension(scope) {
    if (!scope.parent || scope.parent === scope || scope.__whatsappVscodeBridge) return;
    scope.__whatsappVscodeBridge = true;

    const post = (message) => scope.parent.postMessage({ source: 'whatsapp-vscode', ...message }, '*');

    function Notification(title, options) {
        post({ type: 'notify', title: String(title), body: options?.body });
        return Object.assign(new EventTarget(), { close() {}, onclick: null, onclose: null, onerror: null, onshow: null });
    }
    Notification.permission = 'granted';
    Notification.requestPermission = (callback) => {
        if (typeof callback === 'function') callback('granted');
        return Promise.resolve('granted');
    };
    scope.Notification = Notification;

    let unread;
    const report = () => {
        const count = Number(/^\((\d+)\)/.exec(scope.document.title)?.[1] ?? 0);
        if (count === unread) return;
        unread = count;
        post({ type: 'unread', count });
    };
    const watch = () => {
        report();
        new scope.MutationObserver(report).observe(scope.document.head, { childList: true, subtree: true, characterData: true });
    };
    if (scope.document.readyState === 'loading') scope.document.addEventListener('DOMContentLoaded', watch);
    else watch();
}

// WhatsApp names a linked device after the operating system it reads from the user agent ("Mac OS"). The phone
// lists that name from the device properties sent once, at pairing, so they are rewritten as they are encoded.
// WhatsApp's modules register through a global __d(name, deps, factory) that its loader assigns on load.
function nameLinkedDevice(scope) {
    if (scope.__whatsappVscodeDeviceName) return;
    scope.__whatsappVscodeDeviceName = true;

    const isDeviceProps = (value) => value !== null && typeof value === 'object'
        && 'os' in value && 'platformType' in value && 'requireFullSync' in value;
    const wrapEncoder = (exports) => {
        const encode = exports?.encodeProtobuf;
        if (typeof encode !== 'function') return;
        exports.encodeProtobuf = function (spec, value, ...rest) {
            return encode.call(this, spec, isDeviceProps(value) ? { ...value, os: 'whatsapp-vscode' } : value, ...rest);
        };
    };

    let define;
    Object.defineProperty(scope, '__d', {
        configurable: true,
        get: () => define,
        set: (original) => {
            define = typeof original !== 'function' ? original : function (name, deps, factory, ...rest) {
                if (name !== 'encodeProtobuf' || typeof factory !== 'function') {
                    return original.call(this, name, deps, factory, ...rest);
                }
                const wrapped = function (...args) {
                    const result = factory.apply(this, args);
                    args.forEach(wrapEncoder);
                    return result;
                };
                // Keep the factory's arity, in case the loader reads it.
                Object.defineProperty(wrapped, 'length', { value: factory.length });
                return original.call(this, name, deps, wrapped, ...rest);
            };
        },
    });
}

module.exports = {
    rerouteWhatsAppTraffic,
    bridgeToExtension,
    nameLinkedDevice,
    PATCH: `(${rerouteWhatsAppTraffic})(self);\n(${bridgeToExtension})(self);\n(${nameLinkedDevice})(self);\n`,
};
