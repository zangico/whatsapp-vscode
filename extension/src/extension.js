const vscode = require('vscode');
const { fork } = require('child_process');
const path = require('path');
const { buildProxyUrl } = require('./proxyUrl');
const { accountList, accountUrl } = require('./accounts');

const SECTION = 'whatsapp-vscode';
const PASSWORD_KEY = 'whatsapp-vscode.proxy.password';
const DND_KEY = 'whatsapp-vscode.doNotDisturb';

const logger = vscode.window.createOutputChannel('WhatsApp-VSCode');
let server;
let startRequest = 0;
// Port the webviews point at; set by the server once something answers on it.
let serverPort;
// Open webviews, each with the account it is fixed to (undefined: the user picks one in the sidebar).
const webviews = new Map();
// Unread chats per account id, as reported by the page.
const unread = new Map();
let sidebarView;
let globalState;
let unreadItem;
let dndItem;

const config = () => vscode.workspace.getConfiguration(SECTION);
const accounts = () => accountList(config().get('accounts'));

async function startServer(secrets) {
    const request = ++startRequest;
    const settings = vscode.workspace.getConfiguration(SECTION);
    const password = await secrets.get(PASSWORD_KEY);
    if (request !== startRequest) return; // a newer restart is already under way
    // Wait for the old server to release the port, or the new one would see it busy and move to the next port.
    await stopServer();
    if (request !== startRequest) return;

    const port = settings.get('server.port');
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        logger.appendLine(`Invalid server port ${port}, server not started`);
        vscode.window.showErrorMessage('WhatsApp: "whatsapp-vscode.server.port" must be a number between 1024 and 65535.');
        return;
    }
    let proxyUrl;
    try {
        proxyUrl = buildProxyUrl(
            {
                type: settings.get('proxy.type'),
                host: settings.get('proxy.host'),
                port: settings.get('proxy.port'),
                username: settings.get('proxy.username'),
            },
            password
        );
    } catch (error) {
        // A proxy was requested: never fall back to a direct connection.
        logger.appendLine(`Proxy settings are invalid, server not started: ${error.message}`);
        vscode.window.showErrorMessage(`WhatsApp: ${error.message}. Fix the "whatsapp-vscode.proxy" settings.`);
        return;
    }

    // Plain Node child process: VS Code's own proxy handling in the extension host would replace our agent.
    const child = fork(path.join(__dirname, 'server.js'), [], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    child.stdout.on('data', (data) => logger.append(data.toString()));
    child.stderr.on('data', (data) => logger.append(data.toString()));
    child.on('error', (error) => logger.appendLine(`Server process error: ${error.message}`));
    child.on('message', (message) => {
        if (child !== server) return; // late message from a server that was replaced
        if (message.ready) setServerPort(message.ready);
        if (message.error) vscode.window.showErrorMessage(`WhatsApp: ${message.error}. Change "whatsapp-vscode.server.port".`);
    });
    child.on('exit', (code, signal) => logger.appendLine(`Server stopped (${signal || `exit code ${code}`})`));
    child.send({ proxyUrl, port });
    server = child;
}

function stopServer() {
    const child = server;
    server = undefined;
    if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
    return new Promise((resolve) => {
        child.once('exit', resolve);
        child.kill();
    });
}

function setServerPort(port) {
    if (port === serverPort) return;
    serverPort = port;
    refreshWebviews();
}

function refreshWebviews() {
    if (!serverPort) return;
    for (const [webview, fixed] of webviews) webview.html = getWebviewContent(serverPort, fixed);
}

function showWhatsApp(webview, onDidDispose, fixed) {
    webviews.set(webview, fixed);
    onDidDispose(() => webviews.delete(webview));
    webview.onDidReceiveMessage(handleMessage);
    if (serverPort) webview.html = getWebviewContent(serverPort, fixed);
}

const doNotDisturb = () => globalState.get(DND_KEY, false);

function updateIndicators() {
    const known = new Set(accounts().map((account) => account.slug));
    for (const slug of unread.keys()) if (!known.has(slug)) unread.delete(slug);
    const total = [...unread.values()].reduce((sum, count) => sum + count, 0);
    if (sidebarView) {
        sidebarView.badge = total ? { value: total, tooltip: `${total} unread chat${total === 1 ? '' : 's'}` } : undefined;
    }
    const show = config().get('statusBar.enabled');
    unreadItem.text = `$(comment) ${total}`;
    unreadItem.tooltip = `${total} unread WhatsApp chat${total === 1 ? '' : 's'}`;
    if (show && total) unreadItem.show();
    else unreadItem.hide();
    if (show && doNotDisturb()) dndItem.show();
    else dndItem.hide();
}

// Messages come from a page that talks to a third-party site: check every field.
function handleMessage(message) {
    if (!message || message.source !== 'whatsapp-vscode') return;
    const slug = typeof message.account === 'string' ? message.account : '';
    if (message.type === 'unread' && Number.isInteger(message.count) && message.count >= 0) {
        unread.set(slug, message.count);
        updateIndicators();
    } else if (message.type === 'notify' && typeof message.title === 'string') {
        notify(slug, message.title, typeof message.body === 'string' ? message.body : '');
    }
}

function notify(slug, title, body) {
    const settings = config();
    if (!settings.get('notifications.enabled') || doNotDisturb()) return;
    if (settings.get('notifications.muteWhileDebugging') && vscode.debug.activeDebugSession) return;
    const list = accounts();
    const account = list.length > 1 ? list.find((item) => item.slug === slug) : undefined;
    const text = `WhatsApp${account ? ` (${account.name})` : ''}: ${title}${settings.get('notifications.showPreview') && body ? ` - ${body}` : ''}`;
    vscode.window.showInformationMessage(text, 'Open').then((choice) => {
        if (choice === 'Open') vscode.commands.executeCommand('whatsappWebview.focus');
    });
}

async function pickAccount() {
    const list = accounts();
    if (list.length === 1) return list[0];
    const picked = await vscode.window.showQuickPick(list.map((account) => ({ label: account.name, account })), { title: 'WhatsApp account' });
    return picked && picked.account;
}

async function sendSelection() {
    const editor = vscode.window.activeTextEditor;
    const text = editor && editor.document.getText(editor.selection);
    if (!text) return;
    await vscode.env.clipboard.writeText(`\`\`\`\n${text}\n\`\`\``);
    vscode.commands.executeCommand('whatsappWebview.focus');
    vscode.window.setStatusBarMessage('Copied: paste it into a chat', 4000);
}

async function setProxyPassword(secrets) {
    const password = await vscode.window.showInputBox({
        title: 'WhatsApp proxy password',
        prompt: 'Stored in the operating system keychain. Leave empty to remove it.',
        password: true,
        ignoreFocusOut: true,
    });
    if (password === undefined) return;
    if (password) await secrets.store(PASSWORD_KEY, password);
    else await secrets.delete(PASSWORD_KEY);
}

function activate(context) {
    const { secrets } = context;
    globalState = context.globalState;
    unreadItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    unreadItem.name = 'WhatsApp unread chats';
    unreadItem.command = 'whatsappWebview.focus';
    dndItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    dndItem.name = 'WhatsApp Do Not Disturb';
    dndItem.text = '$(bell-slash)';
    dndItem.tooltip = 'WhatsApp Do Not Disturb is on (click to turn it off)';
    dndItem.command = 'whatsapp-vscode.toggleDoNotDisturb';

    context.subscriptions.push(
        logger,
        unreadItem,
        dndItem,
        { dispose: stopServer },
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(`${SECTION}.server`) || event.affectsConfiguration(`${SECTION}.proxy`)) {
                startServer(secrets);
            }
            if (event.affectsConfiguration(`${SECTION}.accounts`) || event.affectsConfiguration(`${SECTION}.zoom`)) refreshWebviews();
            if (event.affectsConfiguration(SECTION)) updateIndicators();
        }),
        secrets.onDidChange((event) => {
            if (event.key === PASSWORD_KEY) startServer(secrets);
        }),
        vscode.commands.registerCommand('whatsapp-vscode.setProxyPassword', () => setProxyPassword(secrets)),
        vscode.commands.registerCommand('whatsapp-vscode.openSettings', () =>
            vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${context.extension.id}`)
        ),
        vscode.commands.registerCommand('whatsapp-vscode.buyMeACoffee', () =>
            vscode.env.openExternal(vscode.Uri.parse('https://buymeacoffee.com/zangico'))
        ),
        vscode.commands.registerCommand('whatsapp-vscode.toggleDoNotDisturb', async () => {
            await globalState.update(DND_KEY, !doNotDisturb());
            updateIndicators();
        }),
        vscode.commands.registerCommand('whatsapp-vscode.sendSelection', sendSelection),
        vscode.commands.registerCommand('whatsapp-vscode.toggle', () =>
            vscode.commands.executeCommand(sidebarView && sidebarView.visible ? 'workbench.action.closeSidebar' : 'whatsappWebview.focus')
        ),
        vscode.commands.registerCommand('whatsapp-vscode.moveView', async () => {
            await vscode.commands.executeCommand('whatsappWebview.focus');
            await vscode.commands.executeCommand('workbench.action.moveFocusedView');
        }),
        vscode.commands.registerCommand('whatsapp-vscode.openWhatsAppWeb', async () => {
            const account = await pickAccount();
            if (!account) return;
            const panel = vscode.window.createWebviewPanel(
                'whatsappWebviewTab',
                accounts().length > 1 ? `WhatsApp \u2014 ${account.name}` : 'WhatsApp',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );
            showWhatsApp(panel.webview, (listener) => panel.onDidDispose(listener), account.slug);
        }),
        vscode.window.registerWebviewViewProvider(
            'whatsappWebview',
            {
                resolveWebviewView(webviewView) {
                    webviewView.webview.options = { enableScripts: true };
                    sidebarView = webviewView;
                    webviewView.onDidDispose(() => { if (sidebarView === webviewView) sidebarView = undefined; });
                    updateIndicators();
                    showWhatsApp(webviewView.webview, (listener) => webviewView.onDidDispose(listener));
                }
            },
            // Keep WhatsApp running (and playing media) while the sidebar is hidden.
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    updateIndicators();
    startServer(secrets);
}

const escapeHtml = (text) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

// `fixed` is the account slug a tab is bound to; the sidebar (undefined) lets the user switch.
function getWebviewContent(port, fixed) {
    const list = accounts();
    const zoom = config().get('zoom');
    const scale = Number.isInteger(zoom) && zoom >= 50 && zoom <= 200 ? zoom / 100 : 1;
    const urls = Object.fromEntries(list.map((account) => [account.slug, accountUrl(account, port)]));
    const picker = fixed === undefined && list.length > 1;
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>WhatsApp Web</title>
            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    height: 100%;
                    width: 100%;
                    overflow: hidden;
                }
                body {
                    display: flex;
                    flex-direction: column;
                }
                select {
                    margin: 2px;
                    background: var(--vscode-dropdown-background);
                    color: var(--vscode-dropdown-foreground);
                    border: 1px solid var(--vscode-dropdown-border);
                }
                #frame {
                    flex: 1;
                    min-height: 0;
                    position: relative;
                    overflow: hidden;
                }
                iframe {
                    border: none;
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: ${100 / scale}%;
                    height: ${100 / scale}%;
                    transform: scale(${scale});
                    transform-origin: 0 0;
                }
            </style>
        </head>
        <body>
            ${picker ? `<select id="account">${list.map((account) => `<option value="${escapeHtml(account.slug)}">${escapeHtml(account.name)}</option>`).join('')}</select>` : ''}
            <div id="frame"><iframe></iframe></div>
            <script>
                const vscode = acquireVsCodeApi();
                const urls = ${JSON.stringify(urls).replace(/</g, '\\u003c')};
                const frame = document.querySelector('iframe');
                const select = document.getElementById('account');
                let account = ${JSON.stringify(fixed === undefined ? '' : fixed)};
                if (select) {
                    const saved = (vscode.getState() || {}).account;
                    if (saved in urls) account = saved;
                    select.value = account;
                    select.addEventListener('change', () => {
                        account = select.value;
                        vscode.setState({ account });
                        frame.src = urls[account];
                    });
                }
                frame.src = urls[account];
                window.addEventListener('message', (event) => {
                    const data = event.data;
                    if (event.source !== frame.contentWindow || !data || data.source !== 'whatsapp-vscode') return;
                    vscode.postMessage({ ...data, account });
                });
            </script>
        </body>
        </html>
    `;
}

function deactivate() {
    return stopServer();
}

module.exports = {
    activate,
    deactivate
};
