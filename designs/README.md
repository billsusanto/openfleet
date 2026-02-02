# Designs

This directory contains Pencil design files (`.pen`) for the Openfleet project.

## What is Pencil?

[Pencil](https://pencil.dev) is an AI-powered design canvas that lives in your IDE. It allows you to:

- Design UI directly in VS Code/Cursor
- Use AI to generate and modify designs
- Keep designs version-controlled alongside code
- Sync designs with your codebase

## Setup

### 1. Install Pencil Extension

**VS Code / Cursor:**

1. Open Extensions (`Cmd/Ctrl + Shift + X`)
2. Search for "Pencil"
3. Click **Install**

Or install from command line:

```bash
code --install-extension highagency.pencildev
# or for Cursor
cursor --install-extension highagency.pencildev
```

### 2. Install Claude Code CLI (for AI features)

```bash
# Install
npm install -g @anthropic-ai/claude-code-cli

# Authenticate
claude
```

### 3. Activate Pencil

1. Create or open a `.pen` file
2. Enter your email when prompted
3. Check email for activation code
4. Enter code to complete activation

## Usage

### Creating a Design

1. Create a new file with `.pen` extension (e.g., `dashboard.pen`)
2. Open it in VS Code/Cursor
3. Press `Cmd/Ctrl + K` to open AI prompt panel
4. Describe what you want to design

### Example Prompts

```
"Create a login form with email and password"
"Design a dashboard with sidebar navigation"
"Add a card component with image, title, and description"
```

### Keyboard Shortcuts

| Shortcut           | Action                       |
| ------------------ | ---------------------------- |
| `Cmd/Ctrl + K`     | Open AI prompt               |
| `Cmd/Ctrl + S`     | Save (no auto-save!)         |
| `Cmd/Ctrl + Click` | Direct select nested element |
| `Shift + Enter`    | Select parent                |

## File Structure

```
designs/
├── README.md           # This file
├── components.pen      # Reusable UI components
├── screens/            # Full screen designs
│   ├── dashboard.pen
│   └── settings.pen
└── flows/              # User flow designs
    └── onboarding.pen
```

## Best Practices

1. **Save frequently** - No auto-save yet
2. **Commit to Git** - `.pen` files are JSON, perfect for version control
3. **Use components** - Create reusable components for consistency
4. **Name descriptively** - `user-profile-card.pen` > `design1.pen`

## Troubleshooting

See [Pencil Troubleshooting](https://docs.pencil.dev/troubleshooting)

Common issues:

- **"Claude Code not connected"** - Run `claude` in terminal to authenticate
- **No Pencil icon** - Create a `.pen` file first, then restart IDE
- **Activation email not received** - Check spam folder
