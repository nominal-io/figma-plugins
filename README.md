# Figma Plugins

A collection of Figma plugins for design system management and icon workflows.

## Plugins

### Design System Icons
**Transform vector icons into React components and manage them in your design system**

A comprehensive Figma plugin that allows you to select vector icons, preview them as React components, and add them to your design system via GitHub integration.

#### Features
- **Design System Icons**: Select icons, preview React components, edit metadata, and add to design system
- **Flatten Icons**: Flatten selected vector icons for easier manipulation
- **Add to Design System**: Directly add selected icons to your design system with GitHub workflow integration

#### Quick Start
1. Install dependencies: `cd design-system-icons && npm install`
2. Build the plugin: `npm run build`
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

## Security

This repository uses environment variables for sensitive data like GitHub Personal Access Tokens. See individual plugin READMEs for setup instructions.

## Contributing

Each plugin is self-contained with its own dependencies and build process. Follow the development instructions in each plugin's directory.
