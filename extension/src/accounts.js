// Extra WhatsApp accounts: each one is served from its own host name (<slug>.localhost), and every
// host name is a separate origin, so the browser keeps a separate WhatsApp login per account.
function accountList(names) {
    const accounts = [{ name: 'Default', slug: '' }];
    const seen = new Set(['']);
    for (const raw of Array.isArray(names) ? names : []) {
        if (typeof raw !== 'string') continue;
        // A DNS label is at most 63 characters.
        const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 63).replace(/^-+|-+$/g, '');
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        accounts.push({ name: raw.trim(), slug });
    }
    return accounts;
}

const accountUrl = (account, port) => `http://${account.slug ? `${account.slug}.` : ''}localhost:${port}`;

module.exports = { accountList, accountUrl };
