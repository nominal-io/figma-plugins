# GitHub Actions Setup for Figma Icons Plugin

This guide will help you set up the GitHub Actions integration for the Figma Icons plugin.

## Prerequisites

1. A GitHub repository with the workflow file already added
2. A GitHub Personal Access Token (PAT) with the required permissions

## Step 1: Create a GitHub Personal Access Token

1. Go to [GitHub Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token" > "Generate new token (classic)"
3. Give it a descriptive name like "Figma Icons Plugin"
4. Set expiration (recommend 1 year or no expiration for automation)
5. Select these scopes:
   - `workflow` - Update GitHub Action workflows
   - `contents:write` - Write access to repository contents
6. Click "Generate token"
7. **Copy the token immediately** - you won't be able to see it again!

## Step 2: Configure the Plugin

1. Open `src/config.ts` in your plugin
2. Update the configuration values:

```typescript
export const GITHUB_CONFIG = {
  OWNER: 'your-github-username', // or your organization name
  REPO: 'your-repository-name', // the repo where you added the workflow
  WORKFLOW_FILE: 'design-system-add-icons.yml', // the workflow file name
  BRANCH: 'main', // the branch to trigger the workflow on
  PAT: 'ghp_your_actual_token_here' // paste your PAT here
}
```

## Step 3: Verify Your Workflow File

Make sure your workflow file is named exactly as specified in `WORKFLOW_FILE` and is located in `.github/workflows/` in your repository.

The workflow should have:
- `workflow_dispatch` trigger
- `icons` input parameter (string type)
- Proper permissions for `contents:write` and `pull-requests:write`

## Step 4: Test the Integration

1. Build your plugin: `npm run build`
2. Load it in Figma
3. Select some icons and click "Add to design system"
4. Check the browser console for the payload being logged
5. Check your GitHub repository for the triggered workflow run

## Troubleshooting

### Common Issues

1. **"Configuration error"** - Check that all values in `config.ts` are properly set
2. **"Failed to trigger workflow: 401"** - Invalid or expired PAT
3. **"Failed to trigger workflow: 404"** - Wrong repository name or workflow file name
4. **"Failed to trigger workflow: 422"** - Invalid workflow input format

### Debug Steps

1. Check the browser console for detailed error messages
2. Verify your PAT has the correct permissions
3. Ensure the workflow file exists and is properly formatted
4. Test the workflow manually from GitHub Actions tab first

### Security Notes

- Never commit your PAT to version control
- Consider using environment variables for production
- Regularly rotate your PATs
- Use the minimum required permissions

## Workflow File Reference

Your workflow file should look like this:

```yaml
name: "Design system: Add icons"

on:
  workflow_dispatch:
    inputs:
      icons:
        description: "JSON array of icons with name and svg properties"
        required: true
        type: string

permissions:
  contents: write
  pull-requests: write

jobs:
  add-icons:
    runs-on: ubuntu-latest
    # ... rest of your workflow steps
```

The plugin will send a JSON payload like this:

```json
[
  {
    "name": "user",
    "svg": "<svg>...</svg>",
    "aliases": ["profile", "account"]
  }
]
```
