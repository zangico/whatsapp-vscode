const test = require('node:test');
const assert = require('node:assert');
const { accountList, accountUrl } = require('../src/accounts');

test('accountList always starts with the default account and slugs the extra names', () => {
    assert.deepStrictEqual(accountList(undefined), [{ name: 'Default', slug: '' }]);
    assert.deepStrictEqual(accountList(['Work', ' My Phone! ', 'work', '!!!', '', 7, 'default']), [
        { name: 'Default', slug: '' },
        { name: 'Work', slug: 'work' },
        { name: 'My Phone!', slug: 'my-phone' },
        { name: 'default', slug: 'default' },
    ]);
    assert.strictEqual(accountList(['a'.repeat(80)])[1].slug.length, 63);
});

test('accountUrl keeps localhost for the default account', () => {
    const [main, work] = accountList(['Work']);
    assert.strictEqual(accountUrl(main, 49153), 'http://localhost:49153');
    assert.strictEqual(accountUrl(work, 49153), 'http://work.localhost:49153');
});
