// GitHub Actions configuration
export const GITHUB_CONFIG = {
  // Update these values to match your repository
  OWNER: 'nominal-io', // Your GitHub username or organization
  REPO: 'galaxy', // Your repository name
  WORKFLOW_FILE: 'design-system-add-icons.yml', // The workflow file name
  BRANCH: 'main', // The branch to trigger the workflow on
  
  // You'll need to replace this with your actual GitHub Personal Access Token
  // Get one from: https://github.com/settings/tokens
  // Required scopes: workflow, contents:write
  // Use environment variable for security
  PAT: process.env.GITHUB_PAT || ''
}

// Validate configuration
export function validateGitHubConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!GITHUB_CONFIG.OWNER || GITHUB_CONFIG.OWNER === 'YOUR_GITHUB_USERNAME') {
    errors.push('GitHub owner is not configured')
  }
  
  if (!GITHUB_CONFIG.REPO || GITHUB_CONFIG.REPO === 'YOUR_REPOSITORY_NAME') {
    errors.push('GitHub repository is not configured')
  }
  
  if (!GITHUB_CONFIG.PAT || GITHUB_CONFIG.PAT === 'YOUR_GITHUB_PAT_HERE') {
    errors.push('GitHub Personal Access Token is not configured')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}