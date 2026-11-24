## Features

> **Moved:** this extension is now published as WhatsApp Sidebar, `zangico.whatsapp-sidebar` (previously `zangico.whatsapp-vscode`). Install this one and uninstall the old one. Settings carry over; set the proxy password again, and scan the QR code again.

WhatsApp for VSCode: use WhatsApp Web inside VS Code, in the sidebar or in an editor tab.

- Optional proxy for all WhatsApp traffic: HTTP, HTTPS, SOCKS4 or SOCKS5, with authentication.
- The proxy password is kept in the operating system keychain.
- Unread badge on the sidebar icon and a status bar counter.
- Notifications as VS Code messages, with Do Not Disturb (`WhatsApp: Toggle Do Not Disturb`) and muting while you debug.
- Several accounts, each with its own login (`whatsapp-sidebar.accounts`).
- `WhatsApp: Copy Selection for Chat` (editor context menu) copies the selected code as a WhatsApp code block; paste it into a chat.
- `WhatsApp: Toggle Chat` (`Ctrl+Alt+W`, `Cmd+Alt+W` on macOS) shows or hides the sidebar.
- `WhatsApp: Move View...` moves WhatsApp to the bottom panel or the secondary sidebar (dragging the activity-bar icon works too).
- `whatsapp-sidebar.zoom` scales the WhatsApp view (50-200%).

## Usage

Use it from the sidebar

or

Open Command Palette with `CTRL`+`SHIFT`+`P` or `F1` and type `Open WhatsApp in Tab`

Link the device with the QR code (WhatsApp on your phone: Settings > Linked devices).

## Proxy settings

Set these in your user settings (Settings > WhatsApp, or the gear icon at the top of the WhatsApp sidebar):

- `whatsapp-sidebar.proxy.type`: `none` (default), `http`, `https`, `socks4` or `socks5`
- `whatsapp-sidebar.proxy.host`: proxy host name or IP (IPv6 in square brackets)
- `whatsapp-sidebar.proxy.port`: proxy port
- `whatsapp-sidebar.proxy.username`: user name, if the proxy needs one

Local port:

- `whatsapp-sidebar.server.port`: local port of the server that serves WhatsApp Web (default `49153`, 1024-65535). If it is used by another program, the next 9 ports are tried in order. WhatsApp keeps a separate login for each port, so changing the port means logging in again.

Other settings: `whatsapp-sidebar.accounts` (names of extra accounts), `whatsapp-sidebar.zoom`, `whatsapp-sidebar.notifications.enabled`, `.showPreview`, `.muteWhileDebugging` and `whatsapp-sidebar.statusBar.enabled`. Notifications and the unread counter work once the WhatsApp view has been opened in the window.

For the password run the command `WhatsApp: Set Proxy Password`. Invalid settings never fall back to a direct connection: WhatsApp is not loaded and an error is shown.

## Known Issues
- Voice messages cannot be recorded
- Audio/video calls do not work
- Not tested: file and media transfers

Every feedback would be appreciated
If you need help or have any question, feel free to ask at zangico@gmail.com

## Support

If you find this extension useful, you can [buy me a coffee](https://buymeacoffee.com/zangico) ☕ (also from the heart icon at the top of the WhatsApp sidebar; hide it with `whatsapp-sidebar.showSupportButton`)

## Release Notes

### 1.2.0

- Settings renamed from `whatsapp-vscode.*` to `whatsapp-sidebar.*`; values set under the old names are moved automatically on the first start

### 1.1.1

- Fix: WhatsApp did not load, or loaded very slowly, on networks where connecting to WhatsApp takes more than 250 ms ("Error occurred while trying to proxy", ETIMEDOUT)

### 1.1.0

- The extension is now WhatsApp Sidebar; the new id is `zangico.whatsapp-sidebar`
- If you use `zangico.whatsapp-vscode`, install this one and uninstall the old one
- Settings carry over; the proxy password must be set again (SecretStorage is per extension id) and the QR code must be scanned again
- Unread badge on the sidebar icon and in the status bar
- VS Code notifications with Do Not Disturb, preview and mute-while-debugging settings
- Multiple accounts (`whatsapp-sidebar.accounts`)
- Copy selection for chat, toggle shortcut, move view and zoom
- Linked devices show as "whatsapp-vscode" on the phone (link the device again to rename an existing one)

### 1.0.0

Initial release
