export interface ProcessedIcon {
  componentName: string;
  reactCode: string;
  jsx: string;
  previewSvg: string;
}

export function getComponentName(filename: string): string {
  // Convert kebab-case to PascalCase
  return `${filename
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}Icon`;
}

// Function to convert stroke to outline by creating a path that represents the stroke
function strokeToOutline(element: Element): string | null {
  const tagName = element.tagName.toLowerCase();
  const stroke = element.getAttribute('stroke');
  const strokeWidth = element.getAttribute('stroke-width') || '1';
  
  if (!stroke || stroke === 'none' || stroke === 'transparent') {
    return null;
  }
  
  // For now, we'll implement a basic approach for common stroke elements
  // This is a simplified version - a full implementation would need more sophisticated path generation
  
  if (tagName === 'line') {
    const x1 = parseFloat(element.getAttribute('x1') || '0');
    const y1 = parseFloat(element.getAttribute('y1') || '0');
    const x2 = parseFloat(element.getAttribute('x2') || '0');
    const y2 = parseFloat(element.getAttribute('y2') || '0');
    const width = parseFloat(strokeWidth);
    
    // Create a rectangle path for the line stroke
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const halfWidth = width / 2;
    
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    // Calculate the four corners of the stroke rectangle
    const x1a = x1 - halfWidth * sin;
    const y1a = y1 + halfWidth * cos;
    const x1b = x1 + halfWidth * sin;
    const y1b = y1 - halfWidth * cos;
    const x2a = x2 - halfWidth * sin;
    const y2a = y2 + halfWidth * cos;
    const x2b = x2 + halfWidth * sin;
    const y2b = y2 - halfWidth * cos;
    
    return `M ${x1a} ${y1a} L ${x2a} ${y2a} L ${x2b} ${y2b} L ${x1b} ${y1b} Z`;
  }
  
  if (tagName === 'circle') {
    const cx = parseFloat(element.getAttribute('cx') || '0');
    const cy = parseFloat(element.getAttribute('cy') || '0');
    const r = parseFloat(element.getAttribute('r') || '0');
    const width = parseFloat(strokeWidth);
    
    // Create two circles - outer and inner
    const outerR = r + width / 2;
    const innerR = Math.max(0, r - width / 2);
    
    if (innerR <= 0) {
      // Solid circle
      return `M ${cx} ${cy - outerR} A ${outerR} ${outerR} 0 1 1 ${cx} ${cy + outerR} A ${outerR} ${outerR} 0 1 1 ${cx} ${cy - outerR} Z`;
    } else {
      // Ring (outer circle minus inner circle)
      return `M ${cx} ${cy - outerR} A ${outerR} ${outerR} 0 1 1 ${cx} ${cy + outerR} A ${outerR} ${outerR} 0 1 1 ${cx} ${cy - outerR} Z M ${cx} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy + innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR} Z`;
    }
  }
  
  if (tagName === 'rect') {
    const x = parseFloat(element.getAttribute('x') || '0');
    const y = parseFloat(element.getAttribute('y') || '0');
    const width = parseFloat(element.getAttribute('width') || '0');
    const height = parseFloat(element.getAttribute('height') || '0');
    const strokeWidth = parseFloat(element.getAttribute('stroke-width') || '1');
    
    // Create a rectangle outline
    const halfStroke = strokeWidth / 2;
    const outerX = x - halfStroke;
    const outerY = y - halfStroke;
    const outerWidth = width + strokeWidth;
    const outerHeight = height + strokeWidth;
    const innerX = x + halfStroke;
    const innerY = y + halfStroke;
    const innerWidth = Math.max(0, width - strokeWidth);
    const innerHeight = Math.max(0, height - strokeWidth);
    
    if (innerWidth <= 0 || innerHeight <= 0) {
      // Solid rectangle
      return `M ${outerX} ${outerY} L ${outerX + outerWidth} ${outerY} L ${outerX + outerWidth} ${outerY + outerHeight} L ${outerX} ${outerY + outerHeight} Z`;
    } else {
      // Rectangle outline
      return `M ${outerX} ${outerY} L ${outerX + outerWidth} ${outerY} L ${outerX + outerWidth} ${outerY + outerHeight} L ${outerX} ${outerY + outerHeight} Z M ${innerX} ${innerY} L ${innerX} ${innerY + innerHeight} L ${innerX + innerWidth} ${innerY + innerHeight} L ${innerX + innerWidth} ${innerY} Z`;
    }
  }
  
  // For path elements with stroke, we can't easily convert to outline without more sophisticated path processing
  // For now, we'll just return the original path data
  return element.getAttribute('d');
}

// Function to flatten multiple SVG paths into a single outlined path
export function flattenSvgPaths(svgContent: string): string {
  try {
    // Check if DOMParser is available
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');
    
    if (!svgElement) {
      throw new Error("No SVG element found");
    }
    
    // Get all elements that are not helper elements
    const allElements = Array.from(svgElement.children);
    const relevantElements = allElements.filter(element => {
      // Skip helper elements
      if (isHelperElement(element)) {
        return false;
      }
      
      // Include path elements and other vector elements
      return ['path', 'line', 'circle', 'rect', 'ellipse', 'polygon', 'polyline'].includes(element.tagName.toLowerCase());
    });
    
    if (relevantElements.length === 0) {
      return svgContent;
    }
    
    // Process each element to convert strokes to outlines and extract path data
    const pathDataArray: string[] = [];
    
    for (const element of relevantElements) {
      const tagName = element.tagName.toLowerCase();
      
      if (tagName === 'path') {
        // Check if it has a stroke that needs to be converted to outline
        const stroke = element.getAttribute('stroke');
        if (stroke && stroke !== 'none' && stroke !== 'transparent') {
          // For now, we'll keep the original path data
          // A full implementation would need to convert the stroke to outline
          const pathData = element.getAttribute('d');
          if (pathData) {
            pathDataArray.push(pathData);
          }
        } else {
          // Regular filled path
          const pathData = element.getAttribute('d');
          if (pathData) {
            pathDataArray.push(pathData);
          }
        }
      } else {
        // Convert other elements to path data
        const strokeOutline = strokeToOutline(element);
        if (strokeOutline) {
          pathDataArray.push(strokeOutline);
        } else {
          // Element without stroke, convert to basic path
          const pathData = element.getAttribute('d');
          if (pathData) {
            pathDataArray.push(pathData);
          }
        }
      }
    }
    
    if (pathDataArray.length === 0) {
      console.warn('No valid path data found');
      return svgContent;
    }
    
    if (pathDataArray.length === 1) {
      return svgContent;
    }
    
    // Combine all path data into a single path
    const combinedPathData = pathDataArray.join(' ');
    
    // Create a new SVG with a single flattened path
    const newSvg = doc.createElement('svg');
    
    // Copy attributes from original SVG
    Array.from(svgElement.attributes).forEach(attr => {
      newSvg.setAttribute(attr.name, attr.value);
    });
    
    // Create the flattened path element
    const flattenedPath = doc.createElement('path');
    flattenedPath.setAttribute('d', combinedPathData);
    flattenedPath.setAttribute('fill', 'currentColor');
    flattenedPath.setAttribute('fill-rule', 'evenodd');
    
    // Remove any stroke attributes to ensure it's properly outlined
    flattenedPath.removeAttribute('stroke');
    flattenedPath.removeAttribute('stroke-width');
    flattenedPath.removeAttribute('stroke-linecap');
    flattenedPath.removeAttribute('stroke-linejoin');
    
    newSvg.appendChild(flattenedPath);
    
    // Convert back to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(newSvg);
    
    } else {
      // DOMParser not available, return original content
      console.warn('DOMParser not available, cannot flatten SVG paths');
      return svgContent;
    }
    
  } catch (error) {
    console.error('Error flattening SVG paths:', error);
    return svgContent; // Return original if flattening fails
  }
}

// Helper function to check if an element is a helper layer (white rectangle, etc.)
function isHelperElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  
  // Check for white rectangles that are likely helper elements
  if (tagName === 'rect') {
    const fill = element.getAttribute('fill');
    const width = element.getAttribute('width');
    const height = element.getAttribute('height');
    
    // Common helper patterns: white rectangles, 24x24 white squares
    if (fill === '#ffffff' || fill === 'white' || fill === '#fff') {
      return true;
    }
    
    // Check for 24x24 rectangles (common helper size)
    if (width === '24' && height === '24') {
      return true;
    }
  }
  
  // Check for elements with helper-like names or IDs
  const id = element.getAttribute('id')?.toLowerCase() || '';
  const className = element.getAttribute('class')?.toLowerCase() || '';
  
  if (id.includes('helper') || id.includes('background') || id.includes('bg') ||
      className.includes('helper') || className.includes('background') || className.includes('bg')) {
    return true;
  }
  
  return false;
}

// Helper function to check if an element is the main icon path
function isMainIconElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  
  // Prioritize path elements (most common for icons)
  if (tagName === 'path') {
    return true;
  }
  
  // Include other vector elements that are likely part of the icon
  if (['circle', 'ellipse', 'line', 'polygon', 'polyline'].includes(tagName)) {
    return true;
  }
  
  return false;
}

export function processSvgToReact(
  svgContent: string,
  iconName: string
): ProcessedIcon & { isSinglePath: boolean } {
  try {
    const componentName = getComponentName(iconName);
    
    // Simple regex-based SVG parsing as fallback
    let viewBox = '0 0 24 24';
    let childElements = '';
    let isSinglePath = false;
    
    try {
      // Try to use DOMParser if available
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const svgElement = doc.querySelector('svg');
      
      if (svgElement) {
        // Extract viewBox
        viewBox = svgElement.getAttribute('viewBox') || '0 0 24 24';
        
        // Filter out helper elements and only process main icon elements
        const mainElements = Array.from(svgElement.children).filter(element => {
          // Skip helper elements
          if (isHelperElement(element)) {
            return false;
          }
          
          // Only include main icon elements
          return isMainIconElement(element);
        });
        
        if (mainElements.length === 0) {
          console.warn('No main icon elements found, falling back to all elements');
          // Fallback: include all non-helper elements
          const fallbackElements = Array.from(svgElement.children).filter(element => !isHelperElement(element));
          mainElements.push(...fallbackElements);
        }
        
        // Check if icon is properly flattened (more sophisticated logic)
        const pathElements = mainElements.filter(element => element.tagName.toLowerCase() === 'path');
        const vectorElements = mainElements.filter(element => 
          ['path', 'circle', 'ellipse', 'line', 'polygon', 'polyline'].includes(element.tagName.toLowerCase())
        );
        
        // Check if all elements are properly outlined (no strokes, only fills)
        let allElementsProperlyOutlined = true;
        let hasStrokes = false;
        
        for (const element of mainElements) {
          const hasStroke = element.hasAttribute('stroke') && 
                           element.getAttribute('stroke') !== 'none' && 
                           element.getAttribute('stroke') !== 'transparent';
          const hasFill = element.hasAttribute('fill') && 
                         element.getAttribute('fill') !== 'none' && 
                         element.getAttribute('fill') !== 'transparent';
          
          if (hasStroke) {
            hasStrokes = true;
            allElementsProperlyOutlined = false;
          }
          
          // For vector elements, they should have either fill or be properly outlined
          if (['path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline'].includes(element.tagName.toLowerCase())) {
            if (!hasFill && !hasStroke) {
              // Element has no fill or stroke - might be empty or malformed
              allElementsProperlyOutlined = false;
            }
          }
        }
        
        // Check if there are any nested elements (groups within groups)
        const hasNestedElements = mainElements.some(element => element.children.length > 0);
        
        // Icon is considered properly flattened if:
        // 1. All elements are properly outlined (no strokes that need conversion)
        // 2. No nested elements (no groups within groups)
        // 3. Either single path element OR multiple properly outlined elements
        const isSinglePathElement = pathElements.length === 1 && mainElements.length === 1;
        const isMultipleProperlyOutlinedElements = mainElements.length > 1 && allElementsProperlyOutlined && !hasStrokes;
        
        // Fixed logic: allow both single path elements AND multiple properly outlined elements
        isSinglePath = (isSinglePathElement || isMultipleProperlyOutlinedElements) && !hasNestedElements;
        
        // Only log warnings for problematic icons
        if (!isSinglePath && mainElements.length > 0) {
          console.warn(`Icon "${iconName}" needs flattening: ${mainElements.length} elements, hasStrokes: ${hasStrokes}, hasNestedElements: ${hasNestedElements}`);
        }
        
        // Extract main icon elements and their attributes
        childElements = mainElements.map(element => {
          const tagName = element.tagName.toLowerCase();
          let attributes = Array.from(element.attributes).map(attr => {
            // Apply SVGR transformations
            let value = attr.value;
            if (attr.name === 'fill' || attr.name === 'stroke') {
              // Convert any solid color fill/stroke to currentColor (except transparent/none)
              if (value !== 'none' && value !== 'transparent' && value !== 'rgba(0,0,0,0)' && 
                  !value.startsWith('url(') && !value.startsWith('hsl(') && !value.startsWith('rgb(')) {
                value = 'currentColor';
              }
            }
            return `${attr.name}="${value}"`;
          }).join(' ');
          
          // Only convert existing fill/stroke colors, don't add new ones
          
          // Format path elements with proper line breaks and indentation
          if (tagName === 'path') {
            // Split attributes more carefully, preserving quoted values
            const attrs = [];
            let current = '';
            let inQuotes = false;
            let quoteChar = '';
            
            for (let i = 0; i < attributes.length; i++) {
              const char = attributes[i];
              if ((char === '"' || char === "'") && !inQuotes) {
                inQuotes = true;
                quoteChar = char;
                current += char;
              } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                quoteChar = '';
                current += char;
              } else if (char === ' ' && !inQuotes) {
                if (current.trim()) {
                  attrs.push(current.trim());
                  current = '';
                }
              } else {
                current += char;
              }
            }
            if (current.trim()) {
              attrs.push(current.trim());
            }
            
            const formattedAttrs = attrs.map(attr => `\n          ${attr}`).join('');
            return `<${tagName}${formattedAttrs}\n        />`;
          }
          
          return `<${tagName} ${attributes} />`;
        }).join('\n        ');
      } else {
        throw new Error("No SVG element found");
      }
      } else {
        // DOMParser not available, skip to regex fallback
        throw new Error("DOMParser not available");
      }
    } catch (domError) {
      console.warn("DOMParser failed, using regex fallback:", domError);
      
      // Fallback: Use regex to extract SVG content
      const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
      if (viewBoxMatch) {
        viewBox = viewBoxMatch[1];
      }
      
      // Extract path elements using regex (prioritize paths for icons)
      const pathMatches = svgContent.match(/<path[^>]*\/>/g) || [];
      const circleMatches = svgContent.match(/<circle[^>]*\/>/g) || [];
      const rectMatches = svgContent.match(/<rect[^>]*\/>/g) || [];
      const otherMatches = svgContent.match(/<(?:ellipse|line|polygon|polyline)[^>]*\/>/g) || [];
      
      // Filter out helper rectangles (white, 24x24, etc.)
      const filteredRectMatches = rectMatches.filter(element => {
        // Skip white rectangles and 24x24 rectangles (likely helpers)
        if (element.includes('fill="#ffffff"') || element.includes('fill="white"') || 
            element.includes('fill="#fff"') || element.includes('width="24"') && element.includes('height="24"')) {
          return false;
        }
        return true;
      });
      
      const allElements = [...pathMatches, ...circleMatches, ...filteredRectMatches, ...otherMatches];
      
      // Check if icon is properly flattened (regex fallback)
      const pathElements = allElements.filter(element => element.startsWith('<path'));
      const vectorElements = allElements.filter(element => 
        element.startsWith('<path') || element.startsWith('<circle') || element.startsWith('<ellipse') ||
        element.startsWith('<line') || element.startsWith('<polygon') || element.startsWith('<polyline')
      );
      
      // Check if all elements are properly outlined (no strokes, only fills)
      let allElementsProperlyOutlined = true;
      let hasStrokes = false;
      
      for (const element of allElements) {
        const hasStroke = element.includes('stroke=') && 
                         !element.includes('stroke="none"') && 
                         !element.includes('stroke="transparent"');
        const hasFill = element.includes('fill=') && 
                       !element.includes('fill="none"') && 
                       !element.includes('fill="transparent"');
        
        if (hasStroke) {
          hasStrokes = true;
          allElementsProperlyOutlined = false;
        }
        
        // For vector elements, they should have either fill or be properly outlined
        if (element.startsWith('<path') || element.startsWith('<circle') || element.startsWith('<ellipse') ||
            element.startsWith('<rect') || element.startsWith('<polygon') || element.startsWith('<polyline')) {
          if (!hasFill && !hasStroke) {
            // Element has no fill or stroke - might be empty or malformed
            allElementsProperlyOutlined = false;
          }
        }
      }
      
      // For regex fallback, we can't easily detect nested elements, so we'll be more conservative
      // and assume that if there are multiple elements, it might not be properly flattened
      const hasMultipleElements = allElements.length > 1;
      
      // Icon is considered properly flattened if:
      // 1. All elements are properly outlined (no strokes that need conversion)
      // 2. Either single path element OR multiple properly outlined elements
      const isSinglePathElement = pathElements.length === 1 && allElements.length === 1;
      const isMultipleProperlyOutlinedElements = allElements.length > 1 && allElementsProperlyOutlined && !hasStrokes;
      
      // Fixed logic: allow both single path elements AND multiple properly outlined elements
      isSinglePath = isSinglePathElement || isMultipleProperlyOutlinedElements;
      
      // Only log warnings for problematic icons (regex fallback)
      if (!isSinglePath && allElements.length > 0) {
        console.warn(`Icon "${iconName}" needs flattening (regex): ${allElements.length} elements, hasStrokes: ${hasStrokes}`);
      }
      
      childElements = allElements.map(element => {
        // Apply SVGR transformations to fill and stroke attributes - convert any solid color to currentColor
        let transformedElement = element.replace(/(fill|stroke)="(?!none|transparent|rgba\(0,0,0,0\)|url\(|hsl\(|rgb\()[^"]*"/g, '$1="currentColor"');
        
        // Only convert existing fill/stroke colors, don't add new ones
        
        // Format path elements with proper line breaks and indentation
        if (element.startsWith('<path')) {
          const match = transformedElement.match(/<path([^>]*)\/>/);
          if (match) {
            const attrString = match[1].trim();
            // Split attributes more carefully, preserving quoted values
            const attrs = [];
            let current = '';
            let inQuotes = false;
            let quoteChar = '';
            
            for (let i = 0; i < attrString.length; i++) {
              const char = attrString[i];
              if ((char === '"' || char === "'") && !inQuotes) {
                inQuotes = true;
                quoteChar = char;
                current += char;
              } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                quoteChar = '';
                current += char;
              } else if (char === ' ' && !inQuotes) {
                if (current.trim()) {
                  attrs.push(current.trim());
                  current = '';
                }
              } else {
                current += char;
              }
            }
            if (current.trim()) {
              attrs.push(current.trim());
            }
            
            const formattedAttrs = attrs.map(attr => `\n          ${attr}`).join('');
            transformedElement = `<path${formattedAttrs}\n        />`;
          }
        }
        
        return transformedElement;
      }).join('\n        ');
    }

    // Create the JSX content with proper formatting
    const jsx = `<svg
        width={size || 24}
        height={size || 24}
        viewBox="${viewBox}"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
        ref={ref}
        {...props}
      >
        ${childElements}
      </svg>`;

    // Create a preview SVG (without React props) for rendering
    const previewSvg = `<svg
        width="24"
        height="24"
        viewBox="${viewBox}"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        ${childElements}
      </svg>`;

    // Generate the full React component code
    const reactCode = `/**
 * (c) Copyright 2025 Nominal Inc. All rights reserved.
 */

import React, { memo } from "react";

import type { IconProps } from "./types";
// Auto-generated icon component
export const ${componentName}: React.NamedExoticComponent<IconProps> = memo(
  function ${componentName}({ size = 24, className, ref, ...props }: IconProps) {
    return (
      ${jsx}
    );
  },
);
${componentName}.displayName = "${componentName}";
export { ${componentName} as ReactComponent };`;

    return {
      componentName,
      reactCode,
      jsx,
      previewSvg,
      isSinglePath,
    };
  } catch (error) {
    console.error("Error processing SVG:", error);
    
    // Return a fallback component if processing fails
    const componentName = getComponentName(iconName);
    const fallbackJsx = `<svg
        width={size || 24}
        height={size || 24}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
        ref={ref}
        {...props}
      >
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>`;
    
    const fallbackCode = `/**
 * (c) Copyright 2025 Nominal Inc. All rights reserved.
 */

import React, { memo } from "react";

import type { IconProps } from "./types";
// Auto-generated icon component (fallback)
export const ${componentName}: React.NamedExoticComponent<IconProps> = memo(
  function ${componentName}({ size = 24, className, ref, ...props }: IconProps) {
    return (
      ${fallbackJsx}
    );
  },
);
${componentName}.displayName = "${componentName}";
export { ${componentName} as ReactComponent };`;

    return {
      componentName,
      reactCode: fallbackCode,
      jsx: fallbackJsx,
      previewSvg: fallbackJsx,
      isSinglePath: false, // Fallback is not a single path
    };
  }
}
