# SFTP Sync

Sync your local workspace to a remote server over **SFTP/SSH** or **FTP/FTPS** — straight from VS Code. Edit files locally with the editor you already know, and have every change pushed to the server automatically on save. Download, diff, watch, and browse the remote filesystem without leaving the editor.

> Maintained and updated by [DRAWNCODES](https://drawncodes.com).
> Forked from the no longer maintained [Natizyskunk/vscode-sftp](https://github.com/Natizyskunk/) SFTP plugin.

---

## Features

- **Upload on save** — every save pushes the file to the remote server.
- **Manual upload / download** — files, folders, or the whole project on demand.
- **Sync directories** — local → remote, remote → local, or both ways.
- **Diff with remote** — compare a local file against its remote copy before overwriting.
- **Remote Explorer** — browse the remote filesystem in the sidebar.
- **File watcher** — auto-upload (and optionally auto-delete) on external file changes.
- **Multiple profiles** — keep `dev` / `prod` targets in one config and switch between them.
- **Multiple contexts** — map different local folders to different remote paths.
- **Connection hopping** — reach a target server through one or more SSH jump hosts.
- **Key, password, or agent auth** for SSH; plain or secure (FTPS) for FTP.

---

## Installation

Install from the VS Code Marketplace:

1. Open the Extensions view (`Ctrl+Shift+X`).
2. Search for **SFTP Sync** (by **DRAWNCODES**) and click **Install**.

Or from a terminal:

```bash
code --install-extension DRAWNCODES.sftp-sync-drawncodes
```

Or in Quick Open (`Ctrl+P`): `ext install DRAWNCODES.sftp-sync-drawncodes`.

---

## Quick start

1. Open the local folder you want to sync.
2. Run **SFTP: Config** from the Command Palette (`Ctrl+Shift+P`). This creates `.vscode/sftp.json`.
3. Fill in your server details (see the reference below) and save.
4. Edit a file and save it — with `"uploadOnSave": true` it uploads immediately.

To pull an existing remote project down first, run **SFTP: Download Project** — it downloads everything under `remotePath` into your open folder. From then on, save to sync.

---

## Configuration — `.vscode/sftp.json`

### Minimal SFTP example

```json
{
  "name": "my server",
  "host": "example.com",
  "protocol": "sftp",
  "port": 22,
  "username": "user",
  "privateKeyPath": "C:\\Users\\me\\.ssh\\id_ed25519",
  "remotePath": "/var/www/project",
  "uploadOnSave": true
}
```

### Minimal FTP example

```json
{
  "name": "my server",
  "host": "example.com",
  "protocol": "ftp",
  "port": 21,
  "secure": true,
  "username": "user",
  "password": "password",
  "remotePath": "/public_html/project",
  "uploadOnSave": true
}
```

> On Windows, backslashes in paths must be escaped (`C:\\Users\\me\\...`).
> If you omit `password`, you'll be prompted for it on connect.

### Common options

| Option | Type | Description |
| --- | --- | --- |
| `name` | string | Label for the connection (required when using multiple contexts). |
| `host` | string | Server hostname or IP. |
| `port` | number | Port (SFTP default `22`, FTP default `21`). |
| `protocol` | `"sftp"` \| `"ftp"` | Transfer protocol. |
| `username` | string | Login user. |
| `password` | string | Password. Omit to be prompted. |
| `remotePath` | string | Remote base directory this workspace maps to. |
| `uploadOnSave` | boolean | Upload a file automatically when you save it. |
| `downloadOnOpen` | boolean | Download the remote copy when a file is opened. |
| `ignore` | string[] | Glob patterns excluded from upload/sync (e.g. `.git`, `node_modules`). |
| `watcher` | object | Auto-upload/delete on external file changes (see below). |
| `useTempFile` | boolean | Upload to a temp file first, then rename (safer for partial writes). |
| `concurrency` | number | Max parallel transfers. |
| `connectTimeout` | number | Connection timeout in ms. |

### SSH authentication

| Option | Description |
| --- | --- |
| `privateKeyPath` | Path to a local private key file. |
| `passphrase` | Passphrase for the key, if it has one. |
| `agent` | Use an SSH agent (e.g. `pageant` on Windows, or the `SSH_AUTH_SOCK` path). |
| `interactiveAuth` | Enable keyboard-interactive auth (for OTP / 2FA prompts). |
| `openSsh` | Use your system OpenSSH config (`sshConfigPath`) for connection settings. |

---

## Profiles

Keep several targets in one file and switch with **SFTP: Set Profile**.

```json
{
  "username": "user",
  "privateKeyPath": "C:\\Users\\me\\.ssh\\id_ed25519",
  "profiles": {
    "dev": {
      "host": "dev.example.com",
      "remotePath": "/var/www/dev",
      "uploadOnSave": true
    },
    "prod": {
      "host": "prod.example.com",
      "remotePath": "/var/www/prod"
    }
  },
  "defaultProfile": "dev"
}
```

`watcher` and `context` are only valid at the top level, not inside a profile.

---

## Multiple contexts

Map different local subfolders to different remote paths. Each `context` must be unique and `name` is required.

```json
[
  {
    "name": "build",
    "context": "project/build",
    "host": "example.com",
    "username": "user",
    "remotePath": "/remote/project/build"
  },
  {
    "name": "src",
    "context": "project/src",
    "host": "example.com",
    "username": "user",
    "remotePath": "/remote/project/src"
  }
]
```

---

## File watcher

Upload (and optionally delete) files when they change outside the editor — useful for build output.

```json
{
  "watcher": {
    "files": "dist/**/*.{js,css}",
    "autoUpload": true,
    "autoDelete": false
  }
}
```

---

## Connection hopping

Reach a target server through one or more SSH jump hosts. Each key path is resolved on the **previous** host in the chain.

```json
{
  "name": "target",
  "remotePath": "/path/on/target",

  "host": "jumpHost",
  "username": "jumpUser",
  "privateKeyPath": "C:\\Users\\me\\.ssh\\id_ed25519",

  "hop": {
    "host": "targetHost",
    "username": "targetUser",
    "privateKeyPath": "/home/jumpUser/.ssh/id_ed25519"
  }
}
```

For multiple hops, make `hop` an array, ordered from the first jump host to the final target.

---

## Remote Explorer

Open the **SFTP** view in the Activity Bar (or run **View: Show SFTP**) to browse the remote filesystem. Files open read-only for preview; run **SFTP: Edit in Local** to pull one down and edit it.

Order the view among other panels with:

```json
{
  "remoteExplorer": {
    "order": 1
  }
}
```

---

## Commands

Open the Command Palette (`Ctrl+Shift+P`) and type `SFTP`. Most commands are also on the file-explorer right-click menu.

- **SFTP: Config** — create / open `sftp.json`.
- **SFTP: Set Profile** — switch the active profile.
- **Upload / Download** — file, active file, folder, or project.
- **Force Upload / Force Download** — ignore timestamp checks.
- **Sync Local → Remote / Remote → Local / Both Directions**.
- **Diff with Remote** — compare local vs remote.
- **List / List All** — list remote directory contents.
- **Delete (Remote)**, **Create Folder**, **Create File**.
- **Open SSH in Terminal**, **Cancel All Transfers**.

---

## Debugging

1. Open Settings and set **`sftp.debug`** to `true`.
2. Reload the window.
3. View logs in **View → Output → sftp**.

---

## License

MIT © 2026 Alexandru — [DRAWNCODES](https://drawncodes.com). See [LICENSE](LICENSE).
