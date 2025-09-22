import { EventHandler } from '@create-figma-plugin/utilities'

export interface IconData {
  id: string
  name: string
  svg: string
  width: number
  height: number
  aliases?: string[]
  metadata?: Record<string, any>
  processedIcon?: ProcessedIcon
  isSinglePath?: boolean
}

export interface ProcessedIcon {
  componentName: string
  reactCode: string
  jsx: string
  previewSvg: string
}

export interface IconProps {
  size?: number
  className?: string
  [key: string]: unknown
}

export interface GetSelectedIconsHandler extends EventHandler {
  name: 'GET_SELECTED_ICONS'
  handler: () => void
}

export interface GetSelectedIconsResponseHandler extends EventHandler {
  name: 'GET_SELECTED_ICONS'
  handler: (data: { icons: IconData[] }) => void
}

export interface AddIconsHandler extends EventHandler {
  name: 'ADD_ICONS'
  handler: (icons: IconData[]) => Promise<void>
}

export interface UpdateIconNameHandler extends EventHandler {
  name: 'UPDATE_ICON_NAME'
  handler: (data: { iconId: string; name: string }) => Promise<void>
}

export interface UpdateIconDescriptionHandler extends EventHandler {
  name: 'UPDATE_ICON_DESCRIPTION'
  handler: (data: { iconId: string; description: string }) => Promise<void>
}

export interface IconUpdatedHandler extends EventHandler {
  name: 'ICON_UPDATED'
  handler: (data: { oldIconId: string; newIconId: string; name: string; description: string }) => void
}

export interface FlattenIconsHandler extends EventHandler {
  name: 'FLATTEN_ICONS'
  handler: (data: { iconIds: string[] }) => Promise<void>
}

export interface ShowSuccessHandler extends EventHandler {
  name: 'SHOW_SUCCESS'
  handler: (data: { iconCount: number; workflowUrl?: string }) => void
}

export interface ShowErrorHandler extends EventHandler {
  name: 'SHOW_ERROR'
  handler: (data: { title: string; message: string; details?: string }) => void
}

export interface CloseConfirmationHandler extends EventHandler {
  name: 'CLOSE_CONFIRMATION'
  handler: () => void
}
