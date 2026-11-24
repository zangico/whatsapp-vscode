# WhatsApp for VS Code

> **Moved:** this extension is now published as WhatsApp Sidebar, `zangico.whatsapp-sidebar` (previously `zangico.whatsapp-vscode`). Install this one and uninstall the old one. Settings carry over; set the proxy password again, and scan the QR code again.

A VS Code extension that shows WhatsApp Web (`https://web.whatsapp.com/`) inside VS Code, in the activity-bar sidebar or in an editor tab. A small local server, started by the extension on `127.0.0.1` (port 49153 by default, configurable), serves WhatsApp Web to the webview and sends all WhatsApp traffic, including the chat WebSocket, through an optional HTTP, HTTPS, SOCKS4 or SOCKS5 proxy.

## Features

- WhatsApp in the sidebar (view `whatsappWebview`, container `whatsapp-sidebar`) and in an editor tab (command `whatsapp-vscode.openWhatsAppWeb`, title "Open WhatsApp in Tab").
- Proxy support (HTTP, HTTPS, SOCKS4, SOCKS5) for all WhatsApp traffic, with optional authentication. The password is stored in the OS keychain (VS Code SecretStorage).
- Unread count on the sidebar badge and in the status bar (read from the WhatsApp page title).
- Notifications as VS Code messages with Do Not Disturb, optional message preview and muting while debugging.
- Several accounts (`whatsapp-sidebar.accounts`), each with its own login.
- Commands: **WhatsApp: Copy Selection for Chat**, **WhatsApp: Toggle Chat** (`Ctrl+Alt+W`, `Cmd+Alt+W` on macOS), **WhatsApp: Move View...**, and the `whatsapp-sidebar.zoom` setting.
- Configurable local port (`whatsapp-sidebar.server.port`, default 49153) with automatic fallback to the next 9 ports when it is used by another program.
- Fail closed: invalid proxy settings never fall back to a direct connection.
- The local server runs on VS Code's own Node runtime, listens on loopback only and stops with the extension.
- The sidebar keeps its state while hidden (`retainContextWhenHidden`).

## Quick usage

1. Install the extension (publisher `zangico`, name `whatsapp-vscode`; VS Code >= 1.91).
2. Click the WhatsApp icon in the activity bar, or run **Open WhatsApp in Tab** from the Command Palette.
3. Link the device with the QR code (see [troubleshooting](docs/troubleshooting.md) for known limitations).
4. To use a proxy, set `whatsapp-sidebar.proxy.type`, `.host`, `.port` (and optionally `.username` plus the **WhatsApp: Set Proxy Password** command). See [docs/configuration.md](docs/configuration.md).

## Repository layout

```
.
├── README.md                  This file
├── .gitignore                 Ignores node_modules/ and *.vsix
├── .github/
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md      Bug report template
│       └── feature_request.md Feature request template
├── docs/
│   ├── architecture.md        Components, request flow, design decisions, limitations
│   ├── configuration.md       Settings, password command, examples
│   ├── development.md         Setup, tests, debugging, packaging, release checklist
│   └── troubleshooting.md     Known limitations and common problems
└── extension/                 The VS Code extension (the only package in the repo)
    ├── package.json           Manifest: commands, settings, views, scripts, dependencies
    ├── package-lock.json      Locked dependencies (must be committed)
    ├── README.md              Marketplace page and release notes
    ├── LICENSE                MIT license
    ├── .vscodeignore          Files excluded from the .vsix (test/**)
    ├── images/
    │   ├── icon.png           Extension icon
    │   └── sidebar_icon.svg   Activity-bar icon
    ├── src/
    │   ├── accounts.js        Account names -> host names (slug)
    │   ├── extension.js       Extension host entry: commands, webviews, server lifecycle
    │   ├── server.js          Local reverse proxy; runs as a child process
    │   ├── migrateSettings.js Moves whatsapp-vscode.* settings to whatsapp-sidebar.*
    │   ├── patch.js           Script prepended to every JavaScript response
    │   └── proxyUrl.js        Settings -> proxy URL (validation)
    └── test/
        ├── accounts.test.js   node:test unit tests for accounts.js
        ├── bridge.test.js     node:test unit tests for the page-to-extension bridge in patch.js
        ├── migrateSettings.test.js node:test unit tests for the settings migration
        ├── proxy.test.js      node:test unit tests for proxyUrl.js and the reroute patch
        └── server.test.js     node:test tests that fork the real server (port fallback, sharing, take-over)
```

## Documentation

- [docs/architecture.md](docs/architecture.md)
- [docs/configuration.md](docs/configuration.md)
- [docs/development.md](docs/development.md)
- [docs/troubleshooting.md](docs/troubleshooting.md)
- [extension/README.md](extension/README.md) (marketplace page, release notes)

## Support

If you find this extension useful, you can [buy me a coffee](https://buymeacoffee.com/zangico).

## License

MIT, see [extension/LICENSE](extension/LICENSE).
