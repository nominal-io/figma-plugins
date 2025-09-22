import { once, on, showUI, emit } from '@create-figma-plugin/utilities'

import { AddIconsHandler, GetSelectedIconsHandler, GetSelectedIconsResponseHandler, IconData, ShowSuccessHandler, ShowErrorHandler } from './types'
import { processSvgToReact, getComponentName } from './svgr-processor'
import { GITHUB_CONFIG, validateGitHubConfig } from './config'

// Helper function to check if a node contains vector content
function hasVectorContent(node: SceneNode): boolean {
  if (node.type === 'VECTOR') {
    return true
  }
  
  // Check for boolean operations (unions, intersections, etc.)
  if (node.type === 'BOOLEAN_OPERATION') {
    return true
  }
  
  if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
    // Check if frame contains vector nodes
    if ('children' in node) {
      return node.children.some(child => hasVectorContent(child))
    }
  }
  
  return false
}

// Helper function to check if a node is exactly 24x24px
function is24x24Frame(node: SceneNode): boolean {
  return node.width === 24 && node.height === 24
}

// Helper function to check if a node has reasonable icon dimensions (for individual vectors)
function hasReasonableIconSize(node: SceneNode): boolean {
  const minSize = 12
  const maxSize = 48
  
  return node.width >= minSize && node.width <= maxSize && 
         node.height >= minSize && node.height <= maxSize
}

// Helper function to get all icon nodes from a selection
function getIconNodes(nodes: readonly SceneNode[]): SceneNode[] {
  const iconNodes: SceneNode[] = []
  
  for (const node of nodes) {
    // Priority 1: 24x24px frames with vector content
    if ((node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') && 
        is24x24Frame(node) && hasVectorContent(node)) {
      iconNodes.push(node)
    }
    // Priority 2: Individual vectors with reasonable size
    else if (node.type === 'VECTOR' && hasReasonableIconSize(node)) {
      iconNodes.push(node)
    }
    // Priority 3: Boolean operations (unions, etc.) with reasonable size
    else if (node.type === 'BOOLEAN_OPERATION' && hasReasonableIconSize(node)) {
      iconNodes.push(node)
    }
    // Priority 4: Other frames with vector content (fallback for non-24x24)
    else if ((node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') && 
             hasVectorContent(node) && hasReasonableIconSize(node)) {
      iconNodes.push(node)
    }
  }
  
  return iconNodes
}

// Track last processed icons for comparison
let lastProcessedIcons: IconData[] = []

// Function to process selection and send to UI
async function processSelection() {
  try {
    const selection = figma.currentPage.selection
    const iconNodes = getIconNodes(selection)
    
    const icons: IconData[] = []

    for (const node of iconNodes) {
      try {
        // Export as SVG
        const svgData = await node.exportAsync({
          format: 'SVG',
          svgIdAttribute: false
        })
        
        // Convert Uint8Array to string
        const svgString = String.fromCharCode.apply(null, Array.from(svgData))

        // Process through SVGR simulation
        let processedIcon;
        try {
          processedIcon = processSvgToReact(svgString, node.name)
        } catch (error) {
          console.error('Error processing icon:', node.name, error)
          // Create a fallback processed icon
          processedIcon = {
            componentName: getComponentName(node.name),
            reactCode: `// Error processing icon: ${node.name}`,
            jsx: `<svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>`,
            previewSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>`,
            isSinglePath: false // Fallback is not a single path
          }
        }
        
        // Get description if the node is a Component
        let description = ''
        if (node.type === 'COMPONENT') {
          description = (node as ComponentNode).description || ''
        }

        icons.push({
          id: node.id,
          name: node.name,
          svg: svgString,
          width: node.width,
          height: node.height,
          processedIcon,
          isSinglePath: processedIcon.isSinglePath,
          metadata: {
            description
          }
        })
        
      } catch (error) {
        console.error(`Error processing icon "${node.name}":`, error)
      }
    }

    // Track the last processed icons for comparison
    lastProcessedIcons = icons
    
    // Send the icons back to the UI
    emit<GetSelectedIconsResponseHandler>('GET_SELECTED_ICONS', { icons })
    
  } catch (error) {
    console.error('Error in processSelection:', error)
    // Send empty array to UI on error to prevent UI from getting stuck
    emit<GetSelectedIconsResponseHandler>('GET_SELECTED_ICONS', { icons: [] })
  }
}

export default function () {
  // Process current selection immediately and add to design system
  const selection = figma.currentPage.selection
  const iconNodes = getIconNodes(selection)
  
  if (iconNodes.length === 0) {
    figma.notify('No icons selected. Please select some icons to add to the design system.')
    figma.closePlugin()
    return
  }

  // Process and add icons to design system immediately
  addIconsToDesignSystem(iconNodes)
}

// Function to add icons to design system
async function addIconsToDesignSystem(iconNodes: SceneNode[]) {
  try {
    const icons: IconData[] = []

    for (const node of iconNodes) {
      try {
        // Export as SVG
        const svgData = await node.exportAsync({
          format: 'SVG',
          svgIdAttribute: false
        })
        
        // Convert Uint8Array to string
        const svgString = String.fromCharCode.apply(null, Array.from(svgData))

        // Process through SVGR simulation
        let processedIcon;
        try {
          processedIcon = processSvgToReact(svgString, node.name)
        } catch (error) {
          console.error('Error processing icon:', node.name, error)
          // Create a fallback processed icon
          processedIcon = {
            componentName: getComponentName(node.name),
            reactCode: `// Error processing icon: ${node.name}`,
            jsx: `<svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>`,
            previewSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>`,
            isSinglePath: false // Fallback is not a single path
          }
        }
        
        // Get description if the node is a Component
        let description = ''
        if (node.type === 'COMPONENT') {
          description = (node as ComponentNode).description || ''
        }

        icons.push({
          id: node.id,
          name: node.name,
          svg: svgString,
          width: node.width,
          height: node.height,
          processedIcon,
          isSinglePath: processedIcon.isSinglePath,
          metadata: {
            description
          }
        })
        
      } catch (error) {
        console.error(`Error processing icon "${node.name}":`, error)
      }
    }

    if (icons.length === 0) {
      figma.notify('No valid icons found to add to design system.')
      figma.closePlugin()
      return
    }

    // Add icons to design system
    await addIconsToGitHub(icons)
    
  } catch (error) {
    console.error('Error adding icons to design system:', error)
    figma.notify('Error adding icons to design system')
  }
}

// Function to add icons to GitHub
async function addIconsToGitHub(icons: IconData[]) {
  // Validate GitHub configuration
  const configValidation = validateGitHubConfig()
  if (!configValidation.isValid) {
    figma.notify(`Configuration Error: ${configValidation.errors.join(', ')}`)
    figma.closePlugin()
    return
  }

  // Dynamic chunking based on actual payload size
  const MAX_PAYLOAD_SIZE = 55000 // Stay well under 64KB limit with some buffer
  const chunks: IconData[][] = []
  
  let currentChunk: IconData[] = []
  let currentChunkSize = 0
  
  for (const icon of icons) {
    // Estimate size for this icon (name + SVG + metadata + JSON overhead)
    const iconPayload = {
      name: icon.name,
      svg: icon.svg,
      aliases: icon.aliases || []
    }
    const estimatedSize = JSON.stringify(iconPayload).length
    
    // If adding this icon would exceed the limit, start a new chunk
    if (currentChunkSize + estimatedSize > MAX_PAYLOAD_SIZE && currentChunk.length > 0) {
      chunks.push([...currentChunk])
      currentChunk = [icon]
      currentChunkSize = estimatedSize
    } else {
      currentChunk.push(icon)
      currentChunkSize += estimatedSize
    }
  }
  
  // Add the last chunk if it has icons
  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }

  let successCount = 0
  let errorCount = 0
  const workflowUrls: string[] = []

  // Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const chunkNumber = i + 1
    const totalChunks = chunks.length

    try {
      // Create icon payload for this chunk
      const iconPayload = chunk.map(icon => ({
        name: icon.name,
        svg: icon.svg,
        aliases: icon.aliases || []
      }))
      
      // Create JSON string and base64 encode it
      const jsonString = JSON.stringify(iconPayload)
      
      // Check if payload is still too large (shouldn't happen with dynamic chunking, but safety check)
      if (jsonString.length > 60000) {
        console.error(`Chunk ${chunkNumber} is still too large (${jsonString.length} bytes)`)
        errorCount += chunk.length
        continue
      }
      
      // Log chunk size for monitoring
      console.log(`Chunk ${chunkNumber}/${totalChunks}: ${chunk.length} icons, ${jsonString.length} bytes`)
      
      let base64Payload
      try {
        // Try btoa first (if available)
        if (typeof btoa !== 'undefined') {
          base64Payload = btoa(jsonString)
        } else {
          throw new Error('btoa not available')
        }
      } catch (error) {
        // Manual base64 encoding fallback
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        let result = ''
        let j = 0
        
        while (j < jsonString.length) {
          const a = jsonString.charCodeAt(j++)
          const b = j < jsonString.length ? jsonString.charCodeAt(j++) : 0
          const c = j < jsonString.length ? jsonString.charCodeAt(j++) : 0
          
          const bitmap = (a << 16) | (b << 8) | c
          
          result += chars.charAt((bitmap >> 18) & 63)
          result += chars.charAt((bitmap >> 12) & 63)
          result += j - 2 < jsonString.length ? chars.charAt((bitmap >> 6) & 63) : '='
          result += j - 1 < jsonString.length ? chars.charAt(bitmap & 63) : '='
        }
        
        base64Payload = result
      }
      
      // Trigger GitHub Actions workflow for this chunk
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/actions/workflows/${GITHUB_CONFIG.WORKFLOW_FILE}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GITHUB_CONFIG.PAT}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            ref: GITHUB_CONFIG.BRANCH,
            inputs: {
              icons: base64Payload,
              chunkInfo: `${chunkNumber}/${totalChunks}` // Add chunk info for tracking
            }
          })
        }
      )

      if (response.ok) {
        // Get the workflow run URL from the response headers
        const workflowRunUrl = response.headers?.get('Location') || 
          `https://github.com/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/actions/workflows/design-system-add-icons.yml`
        
        workflowUrls.push(workflowRunUrl)
        successCount += chunk.length
        
        // Show progress for this chunk
        figma.notify(`Chunk ${chunkNumber}/${totalChunks}: Added ${chunk.length} icon(s) to design system`)
      } else {
        const errorText = await response.text()
        console.error(`GitHub API error for chunk ${chunkNumber}:`, response.status, errorText)
        errorCount += chunk.length
        figma.notify(`Chunk ${chunkNumber}/${totalChunks}: Failed to add icons (${response.status})`)
      }
      
      // Add a small delay between requests to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
      }
      
    } catch (error) {
      console.error(`Error processing chunk ${chunkNumber}:`, error)
      errorCount += chunk.length
      figma.notify(`Chunk ${chunkNumber}/${totalChunks}: Network error`)
    }
  }

  // Show final results
  if (successCount > 0) {
    const workflowUrl = workflowUrls[0] // Show the first workflow URL
    figma.notify(`Successfully added ${successCount} icon(s) to design system! ${errorCount > 0 ? `(${errorCount} failed)` : ''} Workflow: ${workflowUrl}`)
  } else {
    figma.notify(`Failed to add any icons to design system. ${errorCount} icons failed.`)
  }
}
