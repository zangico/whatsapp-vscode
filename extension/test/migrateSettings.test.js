const test = require('node:test');
const assert = require('node:assert');
const { migrateSettings } = require('../src/migrateSettings');

function fakeConfiguration(values) {
    const written = [];
    return {
        values,
        written,
        inspect: (key) => ({ globalValue: values[key] }),
        update: async (key, value, target) => {
            written.push([key, value, target]);
            values[key] = value;
        },
    };
}

test('old values fill the new names that are still unset and are removed', async () => {
    const configuration = fakeConfiguration({
        'whatsapp-vscode.proxy.type': 'socks5',
        'whatsapp-vscode.proxy.port': 1080,
        'whatsapp-vscode.zoom': 120,
        'whatsapp-sidebar.zoom': 90,
        'whatsapp-vscode.notifications.enabled': false,
    });
    await migrateSettings(configuration, [
        'whatsapp-sidebar.proxy.type',
        'whatsapp-sidebar.proxy.port',
        'whatsapp-sidebar.proxy.host',
        'whatsapp-sidebar.zoom',
        'whatsapp-sidebar.notifications.enabled',
    ], 1);
    assert.deepStrictEqual(configuration.written, [
        ['whatsapp-sidebar.proxy.type', 'socks5', 1],
        ['whatsapp-vscode.proxy.type', undefined, 1],
        ['whatsapp-sidebar.proxy.port', 1080, 1],
        ['whatsapp-vscode.proxy.port', undefined, 1],
        ['whatsapp-vscode.zoom', undefined, 1],
        ['whatsapp-sidebar.notifications.enabled', false, 1],
        ['whatsapp-vscode.notifications.enabled', undefined, 1],
    ]);
    assert.strictEqual(configuration.values['whatsapp-sidebar.zoom'], 90);
});

test('nothing is written without old values', async () => {
    const configuration = fakeConfiguration({});
    await migrateSettings(configuration, ['whatsapp-sidebar.zoom', 'other.key'], 1);
    assert.deepStrictEqual(configuration.written, []);
});
