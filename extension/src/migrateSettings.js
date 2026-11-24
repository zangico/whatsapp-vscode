// The settings were renamed from whatsapp-vscode.* to whatsapp-sidebar.* in 1.2.0. Moves the values a user set
// under the old names: the old value fills a new name that is still unset, then the old name is removed.
async function migrateSettings(configuration, keys, target) {
    for (const key of keys) {
        const oldKey = key.replace(/^whatsapp-sidebar\./, 'whatsapp-vscode.');
        if (oldKey === key) continue;
        const oldValue = configuration.inspect(oldKey)?.globalValue;
        if (oldValue === undefined) continue;
        if (configuration.inspect(key)?.globalValue === undefined) await configuration.update(key, oldValue, target);
        await configuration.update(oldKey, undefined, target);
    }
}

module.exports = { migrateSettings };
