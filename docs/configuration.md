# Configuration

All settings are defined in `extension/package.json` under `contributes.configuration`, have `application` scope (user settings only; a workspace `.vscode/settings.json` is ignored), and appear in the Settings UI under "WhatsApp". The gear icon in the WhatsApp sidebar header (command **WhatsApp: Open Settings**, `whatsapp-vscode.openSettings`) opens the Settings UI filtered to this extension.

## Settings

| Key | Type | Default | Meaning |
|---|---|---|---|
| `whatsapp-vscode.server.port` | integer | `49153` | Base port of the local server, 1024 to 65535. If it is used by another program, the next 9 ports are tried in order (never above 65535). WhatsApp keeps a separate login per port. |
| `whatsapp-vscode.proxy.type` | string: `none`, `http`, `https`, `socks4`, `socks5` | `"none"` | Proxy used for all WhatsApp traffic. `none` connects directly. |
| `whatsapp-vscode.proxy.host` | string | `""` | Proxy host name or IP address. IPv6 addresses go in square brackets, for example `[::1]`. Surrounding whitespace is trimmed. |
| `whatsapp-vscode.proxy.port` | integer or null | `null` | Proxy port, 1 to 65535. Required when `type` is not `none`. |
| `whatsapp-vscode.proxy.username` | string | `""` | User name, if the proxy requires authentication. Empty means no authentication. |
| `whatsapp-vscode.accounts` | array of strings | `[]` | Names of extra accounts. The default account always exists and keeps `http://localhost:<port>`. An extra account is served from `http://<slug>.localhost:<port>`, where the slug is the name lowercased with every run of characters outside `a-z0-9` turned into `-` and trimmed (at most 63 characters); empty and duplicate slugs are ignored. Each host name is a separate origin, so each account has its own login. Does not restart the server. |
| `whatsapp-vscode.zoom` | integer | `100` | Zoom of the WhatsApp view in percent, 50 to 200. |
| `whatsapp-vscode.notifications.enabled` | boolean | `true` | Show WhatsApp notifications as VS Code information messages. |
| `whatsapp-vscode.notifications.showPreview` | boolean | `true` | Include the message text in the notification. |
| `whatsapp-vscode.notifications.muteWhileDebugging` | boolean | `true` | Skip notifications while a debug session is active. |
| `whatsapp-vscode.statusBar.enabled` | boolean | `true` | Show the unread counter and the Do Not Disturb indicator in the status bar. |
| `whatsapp-vscode.showSupportButton` | boolean | `true` | Shows the heart (Buy Me a Coffee) button in the WhatsApp sidebar header. Does not restart the server. |

Proxy types map to these URL schemes (`extension/src/proxyUrl.js`):

| `type` | Scheme | Notes |
|---|---|---|
| `http` | `http://` | HTTP proxy, CONNECT tunnelling (`https-proxy-agent`). |
| `https` | `https://` | TLS to the proxy itself (`https-proxy-agent`). |
| `socks4` | `socks4a://` | Host names are resolved by the proxy (`socks-proxy-agent`). |
| `socks5` | `socks5h://` | Host names are resolved by the proxy (`socks-proxy-agent`). |

## Commands

| Command | Meaning |
|---|---|
| **WhatsApp: Toggle Do Not Disturb** (`whatsapp-vscode.toggleDoNotDisturb`) | Mutes or unmutes notifications. Stored in the extension's global state; the status bar shows `$(bell-slash)` while it is on (click it to turn it off). |
| **WhatsApp: Copy Selection for Chat** (`whatsapp-vscode.sendSelection`) | In the editor context menu when text is selected. Copies the selection as a WhatsApp monospace block (three backticks around the code) to the clipboard and reveals the sidebar; paste it into a chat. |
| **WhatsApp: Toggle Chat** (`whatsapp-vscode.toggle`) | `Ctrl+Alt+W` (`Cmd+Alt+W` on macOS). Closes the sidebar if the WhatsApp view is visible, otherwise focuses it. |
| **WhatsApp: Move View...** (`whatsapp-vscode.moveView`) | Focuses the view and opens VS Code's "Move View" picker (bottom panel, secondary sidebar...). Dragging the activity-bar icon also works. |

With more than one account the sidebar shows an account selector (the choice is remembered), and **Open WhatsApp in Tab** asks which account to open.

Notifications and the unread counter come from the WhatsApp page, so they start once the WhatsApp view (or a tab) has been opened in the window.

## Password command

Command Palette: **WhatsApp: Set Proxy Password** (`whatsapp-vscode.setProxyPassword`). It opens a masked input box.

- A non-empty value is stored in VS Code SecretStorage (OS keychain) under the key `whatsapp-vscode.proxy.password`.
- An empty value deletes the stored password.
- Cancelling (Escape) changes nothing.
- The password is only used when `whatsapp-vscode.proxy.username` is non-empty; with an empty user name no credentials are sent.

## What happens when settings change

A change to a `whatsapp-vscode.proxy.*` setting or to `whatsapp-vscode.server.port`, or to the stored password (including from another window), stops the running server and starts a new one with the new proxy URL and port. Overlapping restarts are collapsed (the latest wins).

- Invalid settings (unknown type, bad host, port outside 1-65535 or not an integer): no server is started, an error message "WhatsApp: ... Fix the "whatsapp-vscode.proxy" settings." is shown, and the reason is written to the Output channel `WhatsApp-VSCode`. There is no fallback to a direct connection. Webviews opened before the first successful start stay empty.
- Open webviews are not reloaded when only the proxy changes. If WhatsApp shows a disconnected state after a change, reload the webview (Command Palette: **Developer: Reload Webviews**) or reopen the tab.
- An invalid `whatsapp-vscode.server.port` (not an integer, below 1024 or above 65535): no server is started, an error message "WhatsApp: "whatsapp-vscode.server.port" must be a number between 1024 and 65535." is shown, and the reason is written to the Output channel.
- Open webviews follow the server: when the server reports a different port than the current one, the extension reloads every open webview's content on `http://localhost:<port>`.
- With `type: none` the server connects directly.

## Examples

SOCKS5 proxy running locally on `127.0.0.1:1080`:

```json
{
  "whatsapp-vscode.proxy.type": "socks5",
  "whatsapp-vscode.proxy.host": "127.0.0.1",
  "whatsapp-vscode.proxy.port": 1080
}
```

Authenticated HTTP proxy:

```json
{
  "whatsapp-vscode.proxy.type": "http",
  "whatsapp-vscode.proxy.host": "proxy.example.com",
  "whatsapp-vscode.proxy.port": 3128,
  "whatsapp-vscode.proxy.username": "alice"
}
```

Then run **WhatsApp: Set Proxy Password** and enter the password.

Check the result in the Output channel `WhatsApp-VSCode`; the server logs a line such as `Listening on http://127.0.0.1:49153 via socks5h://127.0.0.1:1080` (host and port only, with "(with credentials)" appended when a user name is set).

## Port and multi-window behaviour

The server tries the configured port (`whatsapp-vscode.server.port`, default `49153`), then the next ports, up to 10 candidates in total and never above 65535. Each VS Code window starts its own server child process. For each candidate port:

- If it binds, the server logs "Listening on ..." and serves on it.
- If it is taken (`EADDRINUSE`) or reserved by the OS (`EACCES`, for example Windows excluded port ranges), the server asks `GET /__whatsapp-vscode/ping` on it (1 second timeout). The reply `whatsapp-vscode` means the server of another VS Code window owns the port: this window's webviews use that server, and this server retries taking the port over every 2 seconds. The owning window's proxy settings apply to both windows. Settings are application-scoped, so windows normally have the same values.
- Any other reply or no reply means another program holds the port: the server logs "Port N is used by another program, trying the next one" and tries the next port.
- If no candidate is usable, the server logs "No usable port between A and B" and the extension shows an error asking to change `whatsapp-vscode.server.port`.

If the owning window closes, another window's server takes over within about 2 seconds. Connections of the other windows break during the hand-over; reload their webviews if WhatsApp does not reconnect. If during the retries the port turns out to be held by a foreign program, the server picks a port again starting from the configured port.

Each port is a separate origin (`http://localhost:<port>`), so WhatsApp keeps a separate login per port:

- Falling back to another port means logging in once on that port. The session on each port persists, and as soon as the configured port is free again the extension goes back to it (and to its login) on the next start.
- Changing `whatsapp-vscode.server.port` means logging in again, unless that port was used before.
- Changing a setting restarts the server in every window; whichever binds the port next serves.
