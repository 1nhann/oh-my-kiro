export interface LookAtArgs {
  file_path?: string
  goal: string
  /**
   * Index into the clipboard files queue (pasted images).
   * -1 = most recent image (last pasted)
   * -2 = second most recent
   * 0 = first/oldest image in queue
   * Only used when file_path is not provided.
   */
  index?: number
}
