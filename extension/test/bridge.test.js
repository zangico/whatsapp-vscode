const test = require('node:test');
const assert = require('node:assert');
const { bridgeToExtension, PATCH } = require('../src/patch');

function fakeScope(title, { framed = true } = {}) {
    const posted = [];
    const scope = {
        document: { title, readyState: 'complete', head: {} },
        MutationObserver: class { constructor(callback) { scope.mutate = callback; } observe() {} },
    };
    scope.parent = framed ? { postMessage: (message, origin) => posted.push([message, origin]) } : scope;
    return { scope, posted };
}

test('bridgeToExtension does nothing outside a frame', () => {
    const { scope, posted } = fakeScope('(2) WhatsApp', { framed: false });
    bridgeToExtension(scope);
    assert.strictEqual(scope.Notification, undefined);
    assert.deepStrictEqual(posted, []);
});

test('the unread count comes from the title and is posted only when it changes', () => {
    const { scope, posted } = fakeScope('(3) WhatsApp');
    bridgeToExtension(scope);
    bridgeToExtension(scope); // second call must not observe twice
    scope.mutate();
    scope.document.title = 'WhatsApp';
    scope.mutate();
    scope.document.title = '(12) WhatsApp';
    scope.mutate();
    scope.document.title = 'Hi (5) there';
    scope.mutate();
    assert.deepStrictEqual(posted.map(([message]) => message), [
        { source: 'whatsapp-vscode', type: 'unread', count: 3 },
        { source: 'whatsapp-vscode', type: 'unread', count: 0 },
        { source: 'whatsapp-vscode', type: 'unread', count: 12 },
        { source: 'whatsapp-vscode', type: 'unread', count: 0 },
    ]);
    assert.ok(posted.every(([, origin]) => origin === '*'));
});

test('the Notification stand-in is granted and posts the notification', async () => {
    const { scope, posted } = fakeScope('WhatsApp');
    bridgeToExtension(scope);
    posted.length = 0;
    const { Notification } = scope;
    assert.strictEqual(Notification.permission, 'granted');
    assert.strictEqual(await Notification.requestPermission(), 'granted');
    let callbackValue;
    await Notification.requestPermission((value) => { callbackValue = value; });
    assert.strictEqual(callbackValue, 'granted');

    const notification = new Notification('Alice', { body: 'hello' });
    new Notification('Bob');
    notification.onclick = () => {};
    notification.close();
    assert.deepStrictEqual(posted.map(([message]) => message), [
        { source: 'whatsapp-vscode', type: 'notify', title: 'Alice', body: 'hello' },
        { source: 'whatsapp-vscode', type: 'notify', title: 'Bob', body: undefined },
    ]);
});

test('PATCH is self-contained source for both functions', () => {
    assert.match(PATCH, /^\(function rerouteWhatsAppTraffic[\s\S]*\)\(self\);\n\(function bridgeToExtension[\s\S]*\)\(self\);\n$/);
});
