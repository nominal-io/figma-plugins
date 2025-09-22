import { once, on, showUI, emit } from '@create-figma-plugin/utilities'

import { FlattenIconsHandler, GetSelectedIconsHandler, GetSelectedIconsResponseHandler, IconData } from './types'

// Track last processed icons for comparison
let lastProcessedIcons: IconData[] = []

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

        // Check if the node needs flattening
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
        } else if (node.type === 'LINE') {
          // Lines with strokes need to be outlined
          const line = node as LineNode
          if (line.strokes && line.strokes.length > 0) {
            needsFlattening = true
            flatteningReason = 'Line with strokes'
          }
        }

        // Create a simple processed icon for flattening purposes
        const processedIcon = {
          componentName: node.name.replace(/[^a-zA-Z0-9]/g, '') + 'Icon',
          reactCode: `// Flattened icon: ${node.name}`,
          jsx: `<svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>`,
          previewSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>`,
          isSinglePath: !needsFlattening
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
          isSinglePath: !needsFlattening,
          metadata: {
            description,
            needsFlattening,
            flatteningReason
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
  // Process current selection immediately and flatten all icons
  const selection = figma.currentPage.selection
  const iconNodes = getIconNodes(selection)
  
  if (iconNodes.length === 0) {
    figma.notify('No icons selected. Please select some icons to flatten.')
    figma.closePlugin()
    return
  }

  // Flatten all selected icons immediately
  flattenSelectedIcons(iconNodes)
}

// Function to flatten selected icons
async function flattenSelectedIcons(iconNodes: SceneNode[]) {
  try {
    for (const node of iconNodes) {
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
    
    figma.notify(`Successfully flattened ${iconNodes.length} icon(s)`)
    
  } catch (error) {
    figma.notify('Error flattening icons')
  }
}
