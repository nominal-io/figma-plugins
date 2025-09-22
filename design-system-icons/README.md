# Design System Icons - Figma Plugin

A Figma plugin that allows users to select vector icons, preview them, add metadata, and add them to a design system package via GitHub PR.

## Features

- **Icon Selection**: Select one or more vector icons from Figma canvas
- **Real-time Preview**: Visual preview of selected icons with their current names
- **React Component Preview**: See exactly how icons will look as React components after SVGR processing
- **Code Generation**: Preview the generated TypeScript React component code
- **Metadata Input**: Edit icon names and add aliases
- **SVG Export**: Automatically extracts SVG data from selected nodes
- **GitHub Integration**: (Coming soon) Creates GitHub PRs to add icons to design system

## Development

### Prerequisites

- Node.js 16+
- npm or yarn
- Figma Desktop App

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the plugin:
   ```bash
   npm run build
   ```

3. Watch for changes during development:
   ```bash
   npm run watch
   ```

### Testing in Figma

1. Open Figma Desktop App
2. Go to `Plugins` → `Development` → `Import plugin from manifest...`
3. Select the `manifest.json` file from this project
4. The plugin will appear in your plugins list as "Design System Icons"

### Using the Plugin

1. **Select Icons**: In Figma, select one or more vector icons (VECTOR, FRAME, or COMPONENT nodes)
2. **Open Plugin**: Run the "Design System Icons" plugin
3. **Preview & Edit**: 
   - See a visual preview of each selected icon
   - Switch between "Visual Preview" and "React Code" tabs
   - View the generated React component code (matches your build script output)
   - Edit the icon name and add aliases (comma-separated)
   - View icon dimensions and component metadata
4. **Add to Design System**: Click "Add X Icon(s) to Design System" (currently shows success notification)

## Project Structure

```
src/
├── main.ts              # Main plugin logic (Figma API interactions)
├── ui.tsx               # React UI components
├── types.ts             # TypeScript type definitions
├── svgr-processor.ts    # SVG to React component processor
├── input.css            # Tailwind CSS input
└── output.css           # Compiled CSS
```

## Current Status

✅ **Completed:**
- Icon selection from Figma canvas
- SVG extraction and preview
- Real-time React component preview (matches build script output)
- Code generation preview with full TypeScript component code
- Metadata input (name, aliases)
- Plugin UI with React and tabbed interface
- TypeScript integration
- SVGR-like processing for accurate previews

🚧 **In Progress:**
- GitHub API integration for PR creation

## Next Steps

1. **GitHub Integration**: Implement GitHub API calls to create PRs
2. **Error Handling**: Add better error handling and user feedback
3. **Validation**: Add icon name validation and duplicate checking
4. **Batch Operations**: Support for bulk icon operations

## Technical Details

- Built with [create-figma-plugin](https://github.com/yuanqing/create-figma-plugin)
- Uses React for UI components
- TypeScript for type safety
- Figma Plugin API for canvas interactions
- SVG export for icon data extraction