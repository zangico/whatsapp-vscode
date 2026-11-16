const test = require('node:test');
const assert = require('node:assert');
const { nameLinkedDevice } = require('../src/patch');

function loadEncoder() {
    const scope = {};
    const defined = {};
    nameLinkedDevice(scope);
    scope.__d = (name, deps, factory) => {
        const exports = {};
        factory(scope, null, null, null, null, {}, exports);
        defined[name] = { exports, arity: factory.length };
    };
    scope.__d('encodeProtobuf', [], (t, n, r, o, a, i, l) => {
        l.encodeProtobuf = (spec, value) => ({ spec, value });
    });
    scope.__d('other', [], (t, n, r, o, a, i, l) => {
        l.encodeProtobuf = (spec, value) => value;
    });
    return defined;
}

test('device properties are encoded with the extension name', () => {
    const { encodeProtobuf } = loadEncoder().encodeProtobuf.exports;
    const props = { os: 'Mac OS', platformType: 0, requireFullSync: false };
    assert.deepStrictEqual(encodeProtobuf('spec', props), {
        spec: 'spec',
        value: { os: 'whatsapp-vscode', platformType: 0, requireFullSync: false },
    });
    assert.strictEqual(props.os, 'Mac OS');
});

test('other messages and modules are left alone', () => {
    const defined = loadEncoder();
    assert.strictEqual(defined.encodeProtobuf.arity, 7);
    assert.deepStrictEqual(defined.encodeProtobuf.exports.encodeProtobuf('spec', { os: 'x' }).value, { os: 'x' });
    const props = { os: 'Mac OS', platformType: 0, requireFullSync: false };
    assert.strictEqual(defined.other.exports.encodeProtobuf('spec', props), props);
});
