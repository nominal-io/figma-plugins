import {
  Button,
  Container,
  IconCheck24,
  IconFrame24,
  IconInspect24,
  IconWarning16,
  Layer,
  LoadingIndicator,
  render,
  SelectableItem,
  Stack,
  Text,
  Textbox,
  TextboxMultiline,
  VerticalSpace
} from '@create-figma-plugin/ui'
import { emit, on } from '@create-figma-plugin/utilities'
import { h } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import Prism from 'prismjs'

import '!./output.css'
import { AddIconsHandler, GetSelectedIconsHandler, GetSelectedIconsResponseHandler, IconData, ProcessedIcon, UpdateIconNameHandler, UpdateIconDescriptionHandler, IconUpdatedHandler, FlattenIconsHandler, ShowSuccessHandler, ShowErrorHandler, CloseConfirmationHandler } from './types'



function ReactCodeDisplay({ processedIcon }: { processedIcon: ProcessedIcon }) {
  // Use Prism.js for syntax highlighting
  const highlightedCode = Prism.highlight(processedIcon.reactCode, Prism.languages.javascript, 'javascript');

  return (
    <div class="bg-[var(--figma-color-bg-secondary)] max-w-full p-3 rounded border border-[var(--figma-color-border)] font-mono text-xs overflow-auto">
      <pre
        class="whitespace-pre-wrap text-[10px]"
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </div>
  );
}

// Utility function to get React component code from a processed icon
export function getReactComponentCode(processedIcon: ProcessedIcon): string {
  return processedIcon.reactCode;
}

function IconPreview({ icon, isLoading, isFlattening, onNameChange, onAliasesChange }: {
  icon: IconData | null
  isLoading: boolean
  isFlattening: boolean
  onNameChange: (name: string) => void
  onAliasesChange: (aliases: string[]) => void
}) {
  const [aliasesText, setAliasesText] = useState(icon?.aliases?.join(', ') || '')

  // Update aliases text when icon changes - show existing aliases or description
  useEffect(() => {
    if (icon) {
      if (icon.aliases && icon.aliases.length > 0) {
        // Show existing aliases
        setAliasesText(icon.aliases.join(', '))
      } else {
        // Check if there's a description to use as aliases
        const description = icon.metadata?.description || ''
        if (description) {
          setAliasesText(description)
          // Also update the aliases in the parent component
          onAliasesChange([description])
        } else {
          setAliasesText('')
        }
      }
    } else {
      setAliasesText('')
    }
  }, [icon, onAliasesChange])

  const handleAliasesChange = useCallback((value: string) => {
    setAliasesText(value)
    // Split by comma and only trim leading/trailing whitespace, preserve spaces within aliases
    const aliases = value.split(',').map(alias => alias.trim()).filter(Boolean)
    onAliasesChange(aliases)
  }, [onAliasesChange])

  return (
    <div class="flex flex-col h-full max-w-full">
      {/* React Component Preview */}
      <div class="flex items-center justify-center min-h-40 grow relative bg-[var(--figma-color-bg-secondary)] border-b border-figma-border">
        {icon ? (
          <div>
            {icon.processedIcon ? (
              <div
                class="flex items-center justify-center [&>svg]:size-20 [&>svg]:text-current [&>svg]:fill-current"
                dangerouslySetInnerHTML={{ __html: icon.processedIcon.previewSvg }}
              />
            ) : (
              <div
                class="flex items-center justify-center [&>svg]:size-12 [&>svg]:text-current [&>svg]:fill-current"
                dangerouslySetInnerHTML={{ __html: icon.svg }}
              />
            )}
            <div class="absolute bottom-1 right-1 px-1.5 py-px bg-[var(--figma-color-bg)] rounded-full font-mono text-[10px] text-[var(--figma-color-text-secondary)]">
              {Math.round(icon.width)}×{Math.round(icon.height)}
            </div>
            {icon.isSinglePath === false && (
              <div class="absolute top-1 left-1 flex items-center gap=px pl-1 pr-2 py-px bg-[var(--figma-color-bg-warning)] rounded-full text-[10px] text-[var(--figma-color-text-onwarning)]">
                <IconWarning16 class="scale-75" />
                <span>Needs to be flattened</span>
              </div>
            )}
          </div>
        ) : (isLoading || isFlattening) ? (
          <div class="max-w-full max-h-full flex items-center justify-center">
            <LoadingIndicator />
          </div>
        ) : (
          <div class="flex flex-col items-center justify-center gap-4">
            <IconInspect24 />
            <Text>Select <code class="font-mono border border-figma-border rounded text-[10px] px-1 py-0.5">24×24px</code> icon(s) to get started</Text>
          </div>
        )}
      </div>

      {/* Form Fields */}
      {icon && (
        <div class="flex-1 overflow-y-auto">
          <Container space="medium">
            <VerticalSpace space="medium" />
            <Stack space="medium">
              <div>
                <Text>Icon Name</Text>
                <VerticalSpace space="extraSmall" />
                <Textbox
                  value={icon?.name || ''}
                  onValueInput={onNameChange}
                  placeholder={icon ? "Enter icon name" : "No icon selected"}
                  disabled={!icon}
                />
              </div>
              <div>
                <Text>Aliases (comma-separated)</Text>
                <VerticalSpace space="extraSmall" />
                <TextboxMultiline
                  value={aliasesText}
                  onValueInput={handleAliasesChange}
                  placeholder={icon ? "e.g. arrow right, chevron right, back arrow" : "No icon selected"}
                  disabled={!icon}
                />
              </div>
              {icon?.processedIcon && (
                <div>
                  <Text>Output Code</Text>
                  <VerticalSpace space="extraSmall" />
                  <ReactCodeDisplay processedIcon={icon.processedIcon} />
                </div>
              )}
            </Stack>
            <VerticalSpace space="medium" />
          </Container>
        </div>
      )}
    </div>
  )
}

type ConfirmationType = 'success' | 'error'

function ConfirmationModal({
  type,
  title,
  message,
  details,
  workflowUrl,
  onClose
}: {
  type: ConfirmationType
  title: string
  message: string
  details?: string
  workflowUrl?: string
  onClose: () => void
}) {
  const isSuccess = type === 'success'
  const isError = type === 'error'

  return (
    <div class="fixed inset-0 bg-[var(--figma-color-bg)] flex items-center justify-center z-50">
      <div class="max-w-md w-full mx-4">
        <Container space="large">
          <div class="text-center flex flex-col items-center gap-4">
            {/* Icon */}
            <div class={`w-6 h-6 rounded-full flex items-center justify-center ${isSuccess
              ? 'bg-[var(--figma-color-bg-success)]'
              : 'bg-[var(--figma-color-bg-error)]'
              }`}>
              {isSuccess ? (
                <IconCheck24 />
              ) : (
                <IconWarning16 />
              )}
            </div>

            {/* Message */}
            <div className="flex flex-col gap-1">
              <div class={`text-lg font-semibold ${isError ? 'text-[var(--figma-color-text-error)]' : ''
                }`}>
                {title}
              </div>
              <div class="text-[var(--figma-color-text-secondary)] text-balance">
                {message}
              </div>
              {details && (
                <div class="text-xs text-[var(--figma-color-text-tertiary)] mt-2 p-2 bg-[var(--figma-color-bg-secondary)] rounded font-mono">
                  {details}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div class="flex gap-2">
              {workflowUrl && isSuccess && (
                <Button
                  secondary
                  onClick={() => {
                    // Open GitHub Actions page in new tab
                    window.open(workflowUrl, '_blank')
                  }}
                >
                  View Progress
                </Button>
              )}
              <Button onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </Container>
      </div>
    </div>
  )
}

function Plugin() {
  const [icons, setIcons] = useState<IconData[]>([])
  const [selectedIconIndex, setSelectedIconIndex] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [hasInitialLoad, setHasInitialLoad] = useState(false)
  const [isFlattening, setIsFlattening] = useState(false)
  const [isAddingToDesignSystem, setIsAddingToDesignSystem] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationType, setConfirmationType] = useState<ConfirmationType>('success')
  const [confirmationTitle, setConfirmationTitle] = useState('')
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [confirmationDetails, setConfirmationDetails] = useState<string | undefined>(undefined)
  const [workflowUrl, setWorkflowUrl] = useState<string | undefined>(undefined)
  const layerListRef = useRef<HTMLDivElement>(null)

  const handleGetSelectedIcons = useCallback(function () {
    // Only show loading if we already have icons (selection change to new selection)
    // Don't show loading when going from icons to empty selection
    if (icons.length > 0) {
      setIsLoading(true)
    }
    emit<GetSelectedIconsHandler>('GET_SELECTED_ICONS')
  }, [icons.length])

  const handleIconSelect = useCallback(function (index: number) {
    setSelectedIconIndex(index)
  }, [])

  const handleKeyDown = useCallback(function (event: KeyboardEvent) {
    if (icons.length === 0) return

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        setSelectedIconIndex(prev => prev > 0 ? prev - 1 : icons.length - 1)
        break
      case 'ArrowDown':
        event.preventDefault()
        setSelectedIconIndex(prev => prev < icons.length - 1 ? prev + 1 : 0)
        break
    }
  }, [icons.length])

  const handleIconNameChange = useCallback(function (name: string) {
    setIcons(prev => prev.map((icon, i) =>
      i === selectedIconIndex ? { ...icon, name } : icon
    ))

    // Emit event to update Figma component name
    if (icons[selectedIconIndex]) {
      emit<UpdateIconNameHandler>('UPDATE_ICON_NAME', {
        iconId: icons[selectedIconIndex].id,
        name: name
      })
    }
  }, [selectedIconIndex, icons])

  const handleIconAliasesChange = useCallback(function (aliases: string[]) {
    setIcons(prev => prev.map((icon, i) =>
      i === selectedIconIndex ? { ...icon, aliases } : icon
    ))

    // Emit event to update Figma component description
    if (icons[selectedIconIndex]) {
      const description = aliases.join(', ')
      emit<UpdateIconDescriptionHandler>('UPDATE_ICON_DESCRIPTION', {
        iconId: icons[selectedIconIndex].id,
        description: description
      })
    }
  }, [selectedIconIndex, icons])

  const handleAddIcons = useCallback(function () {
    // Only export icons that are properly flattened
    const flattenedIcons = icons.filter(icon => icon.isSinglePath === true)
    console.log('handleAddIcons called with', flattenedIcons.length, 'flattened icons')
    setIsAddingToDesignSystem(true)
    emit<AddIconsHandler>('ADD_ICONS', flattenedIcons)
  }, [icons])

  const handleCloseConfirmation = useCallback(function () {
    setShowConfirmation(false)
    setConfirmationType('success')
    setConfirmationTitle('')
    setConfirmationMessage('')
    setConfirmationDetails(undefined)
    setWorkflowUrl(undefined)
  }, [])

  const handleFlattenIcons = useCallback(function () {
    // Get all icons that need flattening
    const iconsToFlatten = icons.filter(icon => icon.isSinglePath === false)
    const iconIds = iconsToFlatten.map(icon => icon.id)

    if (iconIds.length > 0) {
      setIsFlattening(true)
      emit<FlattenIconsHandler>('FLATTEN_ICONS', { iconIds })
    }
  }, [icons])

  useEffect(function () {
    // Listen for the response from the main thread
    on<GetSelectedIconsResponseHandler>('GET_SELECTED_ICONS', function (data) {

      // If we receive empty icons array, it means selection is being processed or no selection
      if (data.icons.length === 0) {
        // Clear existing icons immediately
        setIcons([])
        setHasInitialLoad(true)
        // Always clear loading state for empty selection
        setIsLoading(false)
        return
      }

      // Ensure minimum loading time of 300ms for initial load, shorter for subsequent loads
      const startTime = Date.now()
      const minLoadingTime = hasInitialLoad ? 100 : 300

      setTimeout(() => {
        setIcons(data.icons)
        setSelectedIconIndex(0) // Reset to first icon when selection changes
        setIsLoading(false)
        setHasInitialLoad(true)
      }, Math.max(0, minLoadingTime - (Date.now() - startTime)))
    })

    // Listen for icon updates (when components are created/updated)
    on<IconUpdatedHandler>('ICON_UPDATED', function (data) {
      setIcons(prev => prev.map(icon =>
        icon.id === data.oldIconId
          ? {
            ...icon,
            id: data.newIconId,
            name: data.name,
            metadata: {
              ...icon.metadata,
              description: data.description
            }
          }
          : icon
      ))
    })

    // Listen for flatten completion
    on<GetSelectedIconsResponseHandler>('GET_SELECTED_ICONS', function () {
      setIsFlattening(false)
    })

    // Listen for add to design system completion
    on<AddIconsHandler>('ADD_ICONS', async function (icons) {
      setIsAddingToDesignSystem(false)
    })

    // Listen for success events
    on<ShowSuccessHandler>('SHOW_SUCCESS', function (data) {
      setConfirmationType('success')
      setConfirmationTitle('Icons successfully added')
      setConfirmationMessage(`${data.iconCount} icon${data.iconCount !== 1 ? 's' : ''} ${data.iconCount !== 1 ? 'have' : 'has'} been sent to your design system. A GitHub Actions workflow is now processing your icons and will create a pull request when complete.`)
      setConfirmationDetails(undefined)
      setWorkflowUrl(data.workflowUrl)
      setShowConfirmation(true)
    })

    // Listen for error events
    on<ShowErrorHandler>('SHOW_ERROR', function (data) {
      setConfirmationType('error')
      setConfirmationTitle(data.title)
      setConfirmationMessage(data.message)
      setConfirmationDetails(data.details)
      setWorkflowUrl(undefined)
      setShowConfirmation(true)
    })

    // Listen for close confirmation events
    on<CloseConfirmationHandler>('CLOSE_CONFIRMATION', function () {
      setShowConfirmation(false)
      setConfirmationType('success')
      setConfirmationTitle('')
      setConfirmationMessage('')
      setConfirmationDetails(undefined)
      setWorkflowUrl(undefined)
    })

    // Request the selected icons
    handleGetSelectedIcons()
  }, [handleGetSelectedIcons])

  // Reset selected icon index if it's out of bounds
  useEffect(function () {
    if (icons.length > 0 && selectedIconIndex >= icons.length) {
      setSelectedIconIndex(0)
    }
  }, [icons.length, selectedIconIndex])

  // Set up keyboard navigation
  useEffect(function () {
    const layerList = layerListRef.current
    if (!layerList) return

    layerList.addEventListener('keydown', handleKeyDown)
    return () => layerList.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const selectedIcon = icons[selectedIconIndex]

  return (
    <div class="flex h-full w-full overflow-hidden">
      {/* Confirmation Modal */}
      {showConfirmation && (
        <ConfirmationModal
          type={confirmationType}
          title={confirmationTitle}
          message={confirmationMessage}
          details={confirmationDetails}
          workflowUrl={workflowUrl}
          onClose={handleCloseConfirmation}
        />
      )}
      {/* Left Sidebar - Icon List */}
      {icons.length > 1 && (
        <div class="w-44 border-r border-[var(--figma-color-border)] flex flex-col">
          <div
            ref={layerListRef}
            class="flex-1 overflow-y-auto flex flex-col p-2 focus:outline-none focus:ring-2 focus:ring-[var(--figma-color-border-selected)] focus:ring-inset"
            tabIndex={0}
          >
            {isLoading ? (
              <div class="flex items-center justify-center h-20">
                <LoadingIndicator />
              </div>
            ) : icons.length === 0 ? (
              <div class="flex flex-col items-center justify-center h-20 p-3 text-center">
                <Text class="text-[var(--figma-color-text-secondary)] text-sm">
                  No icons selected
                </Text>
              </div>
            ) : (
              icons.map((icon, index) => (
                <Layer
                  key={icon.id}
                  value={index === selectedIconIndex}
                  onValueChange={() => handleIconSelect(index)}
                  icon={icon.processedIcon ? (
                    <div
                      class="[&>svg]:size-4 [&>svg]:text-current [&>svg]:fill-current ml-1"
                      dangerouslySetInnerHTML={{ __html: icon.processedIcon.previewSvg }}
                    />
                  ) : (
                    <div
                      class="[&>svg]:size-4 [&>svg]:text-current [&>svg]:fill-current ml-1"
                      dangerouslySetInnerHTML={{ __html: icon.svg }}
                    />
                  )
                  }
                >
                  <div className="flex items-center gap-2 h-5">
                    <Text class="font-medium truncate">{icon.name}</Text>
                    {icon.isSinglePath === false && (
                      <div className="text-[var(--figma-color-text-warning)]">
                        <IconWarning16 class="scale-75" />
                      </div>
                    )}
                  </div>
                </Layer>
              ))
            )}
          </div>
          {/* Footer with warning count */}
          {icons.length > 0 && (
            (() => {
              const needsFlatteningCount = icons.filter(icon => icon.isSinglePath === false).length;

              if (needsFlatteningCount > 0) {
                return (
                  <div class="border-t border-[var(--figma-color-border)] p-2">
                    <Button secondary fullWidth onClick={handleFlattenIcons} loading={isFlattening}>
                      Flatten {needsFlatteningCount} icon{needsFlatteningCount !== 1 ? 's' : ''}
                    </Button>
                  </div>
                );
              } else {
                return (
                  null
                );
              }
            })()
          )}
        </div>
      )}
      {/* Right Panel - Preview and Fields */}
      <div class="flex-1 flex flex-col h-full max-w-full overflow-hidden relative">
        <div class="flex-1 overflow-hidden">
          <IconPreview
            icon={icons.length > 0 ? selectedIcon : null}
            isLoading={isLoading}
            isFlattening={isFlattening}
            onNameChange={handleIconNameChange}
            onAliasesChange={handleIconAliasesChange}
          />
        </div>
        {icons.length > 0 && (
          <div className="p-2 border-t border-[var(--figma-color-border)]">
            {(() => {
              const flattenedIcons = icons.filter(icon => icon.isSinglePath === true)
              const unflattenedIcons = icons.filter(icon => icon.isSinglePath === false)

              // Show flatten button if only 1 icon is selected and it's not flattened
              if (icons.length === 1 && unflattenedIcons.length === 1) {
                return (
                  <Button
                    fullWidth
                    onClick={handleFlattenIcons}
                    loading={isFlattening}
                  >
                    Flatten icon
                  </Button>
                )
              }

              // Show add button for flattened icons
              return (
                <Button
                  fullWidth
                  onClick={handleAddIcons}
                  disabled={flattenedIcons.length === 0}
                  loading={isAddingToDesignSystem}
                >
                  Add {flattenedIcons.length} icon{flattenedIcons.length !== 1 ? 's' : ''} to design system
                </Button>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

export default render(Plugin)
