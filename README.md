# Figma Plugins

A collection of Figma plugins for design system management and icon workflows.

## Plugins

### Design System Icons

A comprehensive Figma plugin that allows you to select vector icons, preview them as React components, flatten them into the desired format, and add them to the design system (in Galaxy) via a GitHub action.

#### Features
- **Flatten Icons**: Flatten selected vector icons for easier manipulation
- **Add to Design System**: Directly add selected icons to your design system with GitHub workflow integration

#### Quick Start
1. Install dependencies: `cd design-system-icons && pnpm install`
2. Build the plugin: `pnpm run build`
3. Import `manifest.json` into Figma Desktop App
4. Select icons and run the plugin

#### Development
```bash
cd design-system-icons
npm install
npm run build    # Build once
npm run watch    # Watch for changes
```

## Repository Structure

```
figma-plugins/
├── design-system-icons/     # Main plugin package
│   ├── src/                 # Source code
│   ├── build/               # Compiled plugin files
│   ├── manifest.json        # Plugin manifest
│   └── package.json         # Dependencies and scripts
└── README.md               # This file
```