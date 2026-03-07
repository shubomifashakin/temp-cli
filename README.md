# temp-cli

A command line interface for [Temp](https://temp.545plea.xyz), an ephemeral file sharing platform. Upload files, manage links, and track access directly from your terminal.

## Installation

```bash
npm install -g temp-cli
```

## Authentication

```bash
# Login — opens your browser to authenticate
temp login

# Logout
temp logout
```

## Files

```bash
# Upload a file
temp files cp ./document.pdf --name "My Document" --description "Q1 report for the team"

# List all your files
temp files ls

# Delete a file permanently
temp files rm <fileId>
```

### Upload options

| Flag                | Description                         | Required |
| ------------------- | ----------------------------------- | -------- |
| `--name, -n`        | File name (5–50 characters)         | Yes      |
| `--description, -d` | File description (5–100 characters) | Yes      |

You will be prompted to select a lifetime interactively:

```
? Select file lifetime:
❯ 7 days (short)
  14 days (medium)
  31 days (long)
```

## Links

```bash
# Create a link for a file
temp links create <fileId> --description "Created for xyz recruiter"

# List all links for a file
temp links ls <fileId>

# Revoke a link permanently
temp links rm <fileId> <linkId>
```

### Link options

| Flag                | Description                         | Required |
| ------------------- | ----------------------------------- | -------- |
| `--description, -d` | Link description (5–100 characters) | Yes      |
| `--expires-at, -e`  | Expiry date in YYYY-MM-DD format    | No       |

You will also be prompted to optionally set a password for the link:

```
? Enter password (optional): ********
```

Password must be at least 6 characters and contain at least one uppercase letter, one lowercase letter and one number.

## Requirements

- Node.js >= 18

## License

MIT
