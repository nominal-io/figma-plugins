import { once, on, showUI, emit } from '@create-figma-plugin/utilities'

import { AddIconsHandler, GetSelectedIconsHandler, GetSelectedIconsResponseHandler, IconData, UpdateIconNameHandler, UpdateIconDescriptionHandler, IconUpdatedHandler, FlattenIconsHandler, ShowSuccessHandler, ShowErrorHandler, CloseConfirmationHandler } from './types'
import { processSvgToReact, getComponentName, flattenSvgPaths } from './svgr-processor'
import { GITHUB_CONFIG, validateGitHubConfig } from './config'

// Function to process SVG selection from Figma and output React component code
export function ReactIconRenderer(svgContent: string, iconName: string): string {
  try {
    const processedIcon = processSvgToReact(svgContent, iconName);
    return processedIcon.reactCode;
  } catch (error) {
    console.error('Error processing SVG:', error);
    return `// Error processing icon: ${iconName}`;
  }
}

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

// Function to process icons in chunks to avoid GitHub API limits
async function processIconsInChunks(icons: IconData[]) {
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
        console.log(`Chunk ${chunkNumber}/${totalChunks}: Added ${chunk.length} icon(s) to design system`)
      } else {
        const errorText = await response.text()
        console.error(`GitHub API error for chunk ${chunkNumber}:`, response.status, errorText)
        errorCount += chunk.length
      }
      
      // Add a small delay between requests to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
      }
      
    } catch (error) {
      console.error(`Error processing chunk ${chunkNumber}:`, error)
      errorCount += chunk.length
    }
  }

  // Show final results
  if (successCount > 0) {
    const workflowUrl = workflowUrls[0] // Show the first workflow URL
    emit<ShowSuccessHandler>('SHOW_SUCCESS', { 
      iconCount: successCount,
      workflowUrl: workflowUrl
    })
  } else {
    emit<ShowErrorHandler>('SHOW_ERROR', {
      title: 'Failed to Add Icons',
      message: `Failed to add any icons to design system. ${errorCount} icons failed.`,
      details: 'Please check your GitHub configuration and try again.'
    })
  }
}

// Function to process selection and send to UI
async function processSelection() {
  const startTime = Date.now()
  
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
      
      // Check if the node needs flattening (more sophisticated logic)
      let needsFlattening = false
      let flatteningReason = ''
      
      if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
        // For frames/components, check if they contain multiple vector elements that need flattening
        const vectorChildren = node.children.filter(child => 
          child.type === 'VECTOR' || child.type === 'BOOLEAN_OPERATION' || child.type === 'LINE'
        )
        
        // If there are multiple vector elements, it likely needs flattening
        if (vectorChildren.length > 1) {
          needsFlattening = true
          flatteningReason = `Multiple vector elements (${vectorChildren.length})`
        } else if (vectorChildren.length === 1) {
          // Check if the single vector element has strokes that need to be outlined
          const singleVector = vectorChildren[0]
          if (singleVector.type === 'VECTOR' && (singleVector as VectorNode).strokes && (singleVector as VectorNode).strokes.length > 0) {
            needsFlattening = true
            flatteningReason = 'Single vector with strokes'
          } else if (singleVector.type === 'LINE' && (singleVector as LineNode).strokes && (singleVector as LineNode).strokes.length > 0) {
            needsFlattening = true
            flatteningReason = 'Single line with strokes'
          }
        }
        
        // Also check if any child has nested children (groups within groups)
        const hasNestedGroups = node.children.some(child => 
          'children' in child && (child as any).children && (child as any).children.length > 0
        )
        if (hasNestedGroups) {
          needsFlattening = true
          flatteningReason = flatteningReason ? `${flatteningReason}, nested groups` : 'Nested groups'
        }
      } else if (node.type === 'VECTOR') {
        // For individual vectors, they are usually already properly flattened
        // Only check if they have strokes that need outlining
        const vector = node as VectorNode
        if (vector.strokes && vector.strokes.length > 0) {
          needsFlattening = true
          flatteningReason = 'Vector with strokes'
        }
        // Check if it has children (unusual but possible)
        if ('children' in node && (node as any).children && (node as any).children.length > 0) {
          needsFlattening = true
          flatteningReason = flatteningReason ? `${flatteningReason}, has children` : 'Vector with children'
        }
        // If it's a single vector with no strokes and no children, it's likely already flattened
      } else if (node.type === 'BOOLEAN_OPERATION') {
        // Boolean operations are usually already flattened, but check for strokes
        const booleanOp = node as BooleanOperationNode
        if (booleanOp.strokes && booleanOp.strokes.length > 0) {
          needsFlattening = true
          flatteningReason = 'Boolean operation with strokes'
        }
        // Check if it has children
        if ('children' in node && (node as any).children && (node as any).children.length > 0) {
          needsFlattening = true
          flatteningReason = flatteningReason ? `${flatteningReason}, has children` : 'Boolean operation with children'
        }
        // If it's a single boolean operation with no strokes and no children, it's likely already flattened
      } else if (node.type === 'LINE') {
        // Lines with strokes need to be outlined
        const line = node as LineNode
        if (line.strokes && line.strokes.length > 0) {
          needsFlattening = true
          flatteningReason = 'Line with strokes'
        }
        // If it's a single line with no strokes, it's likely already flattened
      }

      // Process through SVGR simulation
      let processedIcon;
      try {
        processedIcon = processSvgToReact(svgString, node.name)
        // Override isSinglePath if the node needs flattening
        const isSingleNode = node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' || node.type === 'LINE'
        
        if (needsFlattening) {
          // Only override if it's not a single node or if the SVG processor also says it needs flattening
          if (!isSingleNode || !processedIcon.isSinglePath) {
            processedIcon.isSinglePath = false
          }
        }
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
    
    // Performance monitoring
    const endTime = Date.now()
    const processingTime = endTime - startTime
    
    // Only log performance warnings for slow operations
    if (processingTime > 1000) {
      console.warn(`Slow icon processing: ${processingTime}ms for ${icons.length} icons`)
    }
    
    // Send the icons back to the UI
    emit<GetSelectedIconsResponseHandler>('GET_SELECTED_ICONS', { icons })
    
  } catch (error) {
    console.error('Error in processSelection:', error)
    // Send empty array to UI on error to prevent UI from getting stuck
    emit<GetSelectedIconsResponseHandler>('GET_SELECTED_ICONS', { icons: [] })
  }
}

export default function () {
  // Get currently selected icons when plugin opens
  once<GetSelectedIconsHandler>('GET_SELECTED_ICONS', async function () {
    await processSelection()
  })

  // Poll for selection changes with debouncing
  let lastSelectionId = ''
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null
  
  const pollSelection = () => {
    const currentSelection = figma.currentPage.selection
    const currentSelectionId = currentSelection.map(node => node.id).join(',')
    
    if (currentSelectionId !== lastSelectionId) {
      lastSelectionId = currentSelectionId
      
      // Clear existing timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }
      
      // Debounce selection changes to avoid excessive processing
      debounceTimeout = setTimeout(() => {
        // Only emit empty array if we had icons before (selection change to new selection)
        // Don't emit empty array for initial empty selection or going from empty to empty
        if (lastProcessedIcons.length > 0) {
          emit<GetSelectedIconsResponseHandler>('GET_SELECTED_ICONS', { icons: [] })
        }
        processSelection()
      }, 150) // 150ms debounce
    }
  }
  
  // Start polling with reduced frequency
  const pollInterval = setInterval(pollSelection, 750)
  
  // Clean up polling when plugin closes
  figma.on('close', () => {
    clearInterval(pollInterval)
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }
  })

  // Handle adding icons to design system
  once<AddIconsHandler>('ADD_ICONS', async function (icons: IconData[]) {
    // Validate GitHub configuration
    const configValidation = validateGitHubConfig()
    if (!configValidation.isValid) {
      emit<ShowErrorHandler>('SHOW_ERROR', {
        title: 'Configuration Error',
        message: `Please check your GitHub configuration: ${configValidation.errors.join(', ')}`,
        details: 'Update the values in src/config.ts and rebuild the plugin.'
      })
      return
    }

    // Process icons in chunks to avoid GitHub API limits
    await processIconsInChunks(icons)
  })

  // Handle updating icon name
  on<UpdateIconNameHandler>('UPDATE_ICON_NAME', async function (data) {
    try {
      const node = figma.getNodeById(data.iconId)
      if (!node) {
        console.error('Node not found:', data.iconId)
        return
      }

      // If it's not a component, convert it to one
      if (node.type !== 'COMPONENT') {
        if (node.type === 'FRAME' || node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
          const component = figma.createComponent()
          component.name = data.name
          
          // Copy the node's properties
          component.x = node.x
          component.y = node.y
          component.resize(node.width, node.height)
          
          // Move children if it's a frame
          if ('children' in node && 'appendChild' in component) {
            const children = [...node.children]
            for (const child of children) {
              component.appendChild(child)
            }
          } else if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
            // For vector nodes, we need to clone them into the component
            const clonedNode = node.clone()
            component.appendChild(clonedNode)
          }
          
          // Replace the original node
          node.parent?.appendChild(component)
          node.remove()
          
          // Select the new component to maintain selection
          figma.currentPage.selection = [component]
          
          // Notify UI of the update
          emit<IconUpdatedHandler>('ICON_UPDATED', {
            oldIconId: data.iconId,
            newIconId: component.id,
            name: data.name,
            description: ''
          })
          
        } else {
          return
        }
      } else {
        // Update existing component name
        (node as ComponentNode).name = data.name
      }
    } catch (error) {
      console.error('Error updating icon name:', error)
      figma.notify('Failed to update icon name')
    }
  })

  // Handle updating icon description
  on<UpdateIconDescriptionHandler>('UPDATE_ICON_DESCRIPTION', async function (data) {
    try {
      const node = figma.getNodeById(data.iconId)
      if (!node) {
        console.error('Node not found:', data.iconId)
        return
      }

      // If it's not a component, convert it to one first
      if (node.type !== 'COMPONENT') {
        if (node.type === 'FRAME' || node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
          const component = figma.createComponent()
          component.name = node.name
          component.description = data.description
          
          // Copy the node's properties
          component.x = node.x
          component.y = node.y
          component.resize(node.width, node.height)
          
          // Move children if it's a frame
          if ('children' in node && 'appendChild' in component) {
            const children = [...node.children]
            for (const child of children) {
              component.appendChild(child)
            }
          } else if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
            // For vector nodes, we need to clone them into the component
            const clonedNode = node.clone()
            component.appendChild(clonedNode)
          }
          
          // Replace the original node
          node.parent?.appendChild(component)
          node.remove()
          
          // Select the new component to maintain selection
          figma.currentPage.selection = [component]
          
          // Notify UI of the update
          emit<IconUpdatedHandler>('ICON_UPDATED', {
            oldIconId: data.iconId,
            newIconId: component.id,
            name: node.name,
            description: data.description
          })
          
        } else {
          return
        }
      } else {
        // Update existing component description
        (node as ComponentNode).description = data.description
      }
    } catch (error) {
      console.error('Error updating icon description:', error)
      figma.notify('Failed to update icon description')
    }
  })

  // Handle flattening icons
  on<FlattenIconsHandler>('FLATTEN_ICONS', async function (data) {
    try {
      
      for (const iconId of data.iconIds) {
        const node = figma.getNodeById(iconId)
        if (!node) {
          continue
        }

        try {
          // Store the original position and parent
          const originalX = (node as SceneNode).x
          const originalY = (node as SceneNode).y
          const originalParent = node.parent as (BaseNode & ChildrenMixin) | null
          const originalIndex = originalParent ? originalParent.children.indexOf(node as SceneNode) : -1

          // Get all vector/boolean nodes to flatten and convert strokes to outlines first
          let nodesToFlatten: SceneNode[] = []
          let originalRotations: { [key: string]: number } = {}
          
          if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
            // For frames/components, get all vector children and convert strokes to outlines
            const vectorChildren = node.children.filter(child => 
              child.type === 'VECTOR' || child.type === 'BOOLEAN_OPERATION' || child.type === 'LINE'
            )
            
            for (const child of vectorChildren) {
              // Store original rotation and reset it to avoid positioning issues
              const originalRotation = child.rotation
              originalRotations[child.id] = originalRotation
              child.rotation = 0
              
              if (child.type === 'LINE') {
                // Convert line strokes to outlines
                const line = child as LineNode
                if (line.strokes && line.strokes.length > 0) {
                  const outlinedLine = line.outlineStroke()
                  if (outlinedLine) {
                    // Let Figma handle positioning naturally, just set proper fill
                    outlinedLine.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
                    outlinedLine.strokes = []
                    nodesToFlatten.push(outlinedLine)
                  }
                } else {
                  // No strokes, just clone and set proper fill
                  const clonedLine = line.clone()
                  clonedLine.x = line.x
                  clonedLine.y = line.y
                  clonedLine.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
                  clonedLine.strokes = []
                  nodesToFlatten.push(clonedLine)
                }
              } else if (child.type === 'VECTOR') {
                // Convert vector strokes to outlines
                const vector = child as VectorNode
                if (vector.strokes && vector.strokes.length > 0) {
                  const outlinedVector = vector.outlineStroke()
                  if (outlinedVector) {
                    // Let Figma handle positioning naturally, just set proper fill
                    outlinedVector.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
                    outlinedVector.strokes = []
                    nodesToFlatten.push(outlinedVector)
                  }
                } else {
                  // No strokes, just clone and set proper fill
                  const clonedVector = vector.clone()
                  clonedVector.x = vector.x
                  clonedVector.y = vector.y
                  clonedVector.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
                  clonedVector.strokes = []
                  nodesToFlatten.push(clonedVector)
                }
              } else if (child.type === 'BOOLEAN_OPERATION') {
                // Boolean operations don't have strokes, just clone and set proper fill
                const booleanOp = child as BooleanOperationNode
                const clonedBoolean = booleanOp.clone()
                clonedBoolean.x = booleanOp.x
                clonedBoolean.y = booleanOp.y
                clonedBoolean.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
                clonedBoolean.strokes = []
                nodesToFlatten.push(clonedBoolean)
              }
            }
          } else if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' || node.type === 'LINE') {
            // For individual vectors/booleans/lines, convert strokes to outlines first
            // Store original rotation and reset it to avoid positioning issues
            const originalRotation = (node as any).rotation || 0
            originalRotations[node.id] = originalRotation
            ;(node as any).rotation = 0
            
            if (node.type === 'LINE') {
              const line = node as LineNode
                if (line.strokes && line.strokes.length > 0) {
                  const outlinedLine = line.outlineStroke()
                  if (outlinedLine) {
                    // Let Figma handle positioning naturally, just set proper fill
                    outlinedLine.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
                    outlinedLine.strokes = []
                    nodesToFlatten.push(outlinedLine)
                  }
              } else {
                // No strokes, just clone and set proper fill
                const clonedLine = line.clone()
                clonedLine.x = line.x
                clonedLine.y = line.y
                clonedLine.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
                clonedLine.strokes = []
                nodesToFlatten.push(clonedLine)
              }
            } else if (node.type === 'VECTOR') {
              const vector = node as VectorNode
              if (vector.strokes && vector.strokes.length > 0) {
                const outlinedVector = vector.outlineStroke()
                if (outlinedVector) {
                  // Let Figma handle positioning naturally, just set proper fill
                  outlinedVector.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
                  outlinedVector.strokes = []
                  nodesToFlatten.push(outlinedVector)
                }
              } else {
                // No strokes, just clone and set proper fill
                const clonedVector = vector.clone()
                clonedVector.x = vector.x
                clonedVector.y = vector.y
                clonedVector.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
                clonedVector.strokes = []
                nodesToFlatten.push(clonedVector)
              }
            } else if (node.type === 'BOOLEAN_OPERATION') {
              // Boolean operations don't have strokes, just clone and set proper fill
              const booleanOp = node as BooleanOperationNode
              const clonedBoolean = booleanOp.clone()
              clonedBoolean.x = booleanOp.x
              clonedBoolean.y = booleanOp.y
              clonedBoolean.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
              clonedBoolean.strokes = []
              nodesToFlatten.push(clonedBoolean)
            }
          }

          if (nodesToFlatten.length === 0) {
            continue
          }

          // Create flattened node
          let flattenedNode: VectorNode
          
          if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
            // Calculate the center point of all vector children to position the flattened node
            let totalX = 0
            let totalY = 0
            let count = 0
            
            for (const child of nodesToFlatten) {
              totalX += child.x + child.width / 2
              totalY += child.y + child.height / 2
              count++
            }
            
            const centerX = count > 0 ? totalX / count : 0
            const centerY = count > 0 ? totalY / count : 0
            
            // Create flattened node within the original frame
            flattenedNode = figma.flatten(nodesToFlatten, node, 0)
            
            // Position the flattened node at the center of the original children
            flattenedNode.x = centerX - flattenedNode.width / 2
            flattenedNode.y = centerY - flattenedNode.height / 2
            
            // Set the name to "Vector"
            flattenedNode.name = 'Vector'
            
            // Set proper fill and remove strokes
            flattenedNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
            flattenedNode.strokes = []
            
            // Set constraints to scale for both vertical and horizontal
            flattenedNode.constraints = {
              horizontal: 'SCALE',
              vertical: 'SCALE'
            }
            
            // Apply the original rotation back to the flattened node
            flattenedNode.rotation = originalRotations[node.id] || 0
            
            // Remove all other children from the frame, keeping only the flattened node
            const childrenToRemove = node.children.filter(child => child.id !== flattenedNode.id)
            for (const child of childrenToRemove) {
              child.remove()
            }
          } else {
            // For individual vectors/booleans, create in the original parent
            flattenedNode = figma.flatten(nodesToFlatten, originalParent || undefined, originalIndex)
            
            // Set the name to "Vector" and position
            flattenedNode.name = 'Vector'
            flattenedNode.x = originalX
            flattenedNode.y = originalY
            
            // Set proper fill and remove strokes
            flattenedNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
            flattenedNode.strokes = []
            
            // Set constraints to scale for both vertical and horizontal
            flattenedNode.constraints = {
              horizontal: 'SCALE',
              vertical: 'SCALE'
            }
            
            // Apply the original rotation back to the flattened node
            flattenedNode.rotation = originalRotations[node.id] || 0
            
            // Remove the original node
            node.remove()
          }

          // Select the new flattened node
          figma.currentPage.selection = [flattenedNode]
          
        } catch (error) {
          figma.notify(`Error flattening icon: ${node.name}`)
        }
      }
      
      figma.notify(`Successfully flattened ${data.iconIds.length} icon(s)`)
      
      // Refresh the selection to update the UI
      processSelection()
      
    } catch (error) {
      figma.notify('Error flattening icons')
    }
  })

  // Handle closing confirmation modal
  on<CloseConfirmationHandler>('CLOSE_CONFIRMATION', function () {
    figma.closePlugin()
  })

  showUI({ height: 520, width: 480 })
}
