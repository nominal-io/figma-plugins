# GitHub Actions Workflow Update

The plugin now sends the icons data as a base64-encoded string to avoid shell escaping issues. Update your workflow step:

## Replace this step:
```yaml
- name: Parse and validate icons input
  id: parse
  run: |
    # Validate JSON input
    echo '${{ github.event.inputs.icons }}' > icons.json
    if ! jq empty icons.json 2>/dev/null; then
      echo "❌ Invalid JSON input"
      exit 1
    fi
```

## With this updated step:
```yaml
- name: Parse and validate icons input
  id: parse
  run: |
    # Decode base64 input and validate JSON
    echo '${{ github.event.inputs.icons }}' | base64 -d > icons.json
    if ! jq empty icons.json 2>/dev/null; then
      echo "❌ Invalid JSON input"
      echo "Raw input: ${{ github.event.inputs.icons }}"
      exit 1
    fi
```

## Why This Works:
- Base64 encoding eliminates all shell escaping issues
- No special characters, newlines, or quotes to worry about
- The `base64 -d` command safely decodes the data
- Much more reliable than trying to handle raw JSON in shell

## Test the Fix:
1. Update your workflow with the new step
2. Test the plugin again
3. The workflow should now process the icons correctly

