# Troubleshooting

Root causes are explained in [architecture.md](architecture.md#known-limitations-and-root-causes). First step for any problem: open the Output channel **WhatsApp-VSCode**.

## Known limitations

| Problem | Cause | Workaround |
|---|---|---|
| Voice messages and calls do not work | The webview iframe policy has no `microphone` or `camera` permission. | Use another WhatsApp client. |
| Messaging stops working after a WhatsApp update | WhatsApp Web may add checks or a stricter Content-Security-Policy that this extension removes only for the listed headers. | Report an issue with the console errors from the webview developer tools. |

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| Sidebar or tab stays blank | Proxy settings are invalid, so the server was not started and the webviews never get their content. | Read the error message and the Output channel; fix `whatsapp-vscode.proxy.*`. Settings changes restart the server, then reopen the tab. |
| Sidebar or tab stays blank and an error asks to fix `whatsapp-vscode.server.port` | The value is not an integer between 1024 and 65535, so the server was not started. | Fix the setting; the server restarts. |
| Error "No usable port between A and B" | All 10 candidate ports (the configured port and the next 9) are used by other programs or reserved by the OS (for example Windows excluded port ranges). | Change `whatsapp-vscode.server.port` to another range, or free a port (`lsof -i :49153` on macOS and Linux, `netstat -ano` on Windows). Logging in is needed again on a new port. |
| Output channel shows `Port N is used by another program, trying the next one` | Another program holds port N (or the OS reserves it, `EACCES`). The server uses the next free port, which is a different origin. | Log in once on the new port. The session on each port persists, and the extension returns to the configured port (and its login) on the next start once it is free. To stay on the configured port, free it (`lsof -i :49153`). |
| Logged out and the Output channel shows a port other than the configured one | Each port is a separate origin, so WhatsApp keeps a separate login per port.  | Link the device again on the new port, or free the configured port and restart the extension. |
| Messaging works in one window but not after closing another window | The window that owned the port closed; another server takes over within about 2 seconds. | Wait, then reload the webview. |
| Requests fail with HTTP 500 after setting a proxy | The proxy is unreachable or refuses the connection. The extension deliberately does not fall back to a direct connection. | Check type, host, port, credentials; check the proxy is running. |
| Proxy requires authentication, connection refused | No user name set, or no password stored. | Set `whatsapp-vscode.proxy.username`, run **WhatsApp: Set Proxy Password**. |
| WhatsApp shows "connecting" after changing a proxy setting | Open webviews are not reloaded when the server restarts. | **Developer: Reload Webviews**, or reopen the tab. |
| Logged out after an update | The login lives in the storage of the origin `http://localhost:<port>`; clearing webview data or a different port (changed setting or fallback) resets it. | Log in again. The session on each port survives normal restarts. |
| Sidebar and tab ask for login separately | They are separate webviews; sharing depends on Chromium storage partitioning (not verified). | Log in in each, or use one of them. |
| No notifications or unread badge after starting VS Code | They come from the WhatsApp page, which only runs once the WhatsApp view (or a tab) has been opened. | Open the WhatsApp view once; it keeps running while hidden. |
| No notification for a message | Do Not Disturb is on (bell-slash in the status bar), a debug session is active, or `whatsapp-vscode.notifications.enabled` is off. | Toggle Do Not Disturb or change the `notifications` settings. |
| A new account asks for the QR code | Each account is a separate origin and has its own login. | Link the device once per account. |
| IPv6 proxy address is rejected | Host must be in square brackets. | Use `[::1]`, not `::1`. |
