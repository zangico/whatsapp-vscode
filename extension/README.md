## Features

WhatsApp for VSCode: use WhatsApp Web inside VS Code, in the sidebar or in an editor tab.

- Optional proxy for all WhatsApp traffic: HTTP, HTTPS, SOCKS4 or SOCKS5, with authentication.
- The proxy password is kept in the operating system keychain.

## Usage

Use it from the sidebar

or

Open Command Palette with `CTRL`+`SHIFT`+`P` or `F1` and type `Open WhatsApp in Tab`

Link the device with the QR code (WhatsApp on your phone: Settings > Linked devices).

## Proxy settings

Set these in your user settings (Settings > WhatsApp, or the gear icon at the top of the WhatsApp sidebar):

- `whatsapp-vscode.proxy.type`: `none` (default), `http`, `https`, `socks4` or `socks5`
- `whatsapp-vscode.proxy.host`: proxy host name or IP (IPv6 in square brackets)
- `whatsapp-vscode.proxy.port`: proxy port
- `whatsapp-vscode.proxy.username`: user name, if the proxy needs one

Local port:

- `whatsapp-vscode.server.port`: local port of the server that serves WhatsApp Web (default `49153`, 1024-65535). If it is used by another program, the next 9 ports are tried in order. WhatsApp keeps a separate login for each port, so changing the port means logging in again.

For the password run the command `WhatsApp: Set Proxy Password`. Invalid settings never fall back to a direct connection: WhatsApp is not loaded and an error is shown.

## Known Issues
- Voice messages cannot be recorded
- Audio/video calls do not work
- Not tested: file and media transfers, notifications

Every feedback would be appreciated
If you need help or have any question, feel free to ask at zangico@gmail.com

## Support

If you find this extension useful, you can [buy me a coffee](https://buymeacoffee.com/zangico) ☕ (also from the heart icon at the top of the WhatsApp sidebar; hide it with `whatsapp-vscode.showSupportButton`)

## Release Notes

### 1.0.0

Initial release
