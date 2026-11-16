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

module.exports = {
    rerouteWhatsAppTraffic,
    PATCH: `(${rerouteWhatsAppTraffic})(self);\n`,
};
