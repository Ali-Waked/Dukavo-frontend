/**
 * A tiny, safe renderer for the plain-text bodies stored on content pages.
 *
 * Content is authored as text — never HTML — so there is nothing to sanitise
 * and no way for a stored page to inject markup. The conventions are the ones
 * an editor can type by hand:
 *
 *   - a blank line separates blocks;
 *   - a line starting with `- ` or `* ` is a bullet in an unordered list;
 *   - a line starting with `1. ` (or `1) `) is an item in an ordered list;
 *   - a line starting with `> ` is a note/callout;
 *   - anything else is a paragraph, and consecutive paragraph lines are joined.
 */

export type ContentBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'note'; text: string }

const UNORDERED = /^[-*]\s+/
const ORDERED = /^\d+[.)]\s+/
const NOTE = /^>\s?/

type Mode = 'paragraph' | 'unordered' | 'ordered' | 'note' | null

export function parseContentBlocks(body: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  let mode: Mode = null
  let buffer: string[] = []

  const flush = (): void => {
    if (buffer.length === 0) {
      mode = null
      return
    }

    if (mode === 'unordered') {
      blocks.push({ kind: 'list', ordered: false, items: buffer })
    } else if (mode === 'ordered') {
      blocks.push({ kind: 'list', ordered: true, items: buffer })
    } else if (mode === 'note') {
      blocks.push({ kind: 'note', text: buffer.join(' ') })
    } else {
      blocks.push({ kind: 'paragraph', text: buffer.join(' ') })
    }

    buffer = []
    mode = null
  }

  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()

    if (line === '') {
      flush()
      continue
    }

    if (UNORDERED.test(line)) {
      if (mode !== 'unordered') flush()
      mode = 'unordered'
      buffer.push(line.replace(UNORDERED, ''))
    } else if (ORDERED.test(line)) {
      if (mode !== 'ordered') flush()
      mode = 'ordered'
      buffer.push(line.replace(ORDERED, ''))
    } else if (NOTE.test(line)) {
      if (mode !== 'note') flush()
      mode = 'note'
      buffer.push(line.replace(NOTE, ''))
    } else {
      if (mode !== 'paragraph') flush()
      mode = 'paragraph'
      buffer.push(line)
    }
  }

  flush()

  return blocks
}

export interface LabeledItem {
  title: string
  description: string
}

/**
 * Parse a `cards` or `steps` body: each non-empty line is one item, split on
 * the first `: ` into a title and a description. A line with no colon is a
 * title on its own.
 */
export function parseLabeledItems(body: string): LabeledItem[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const separator = line.indexOf(': ')

      if (separator === -1) {
        return { title: line, description: '' }
      }

      return {
        title: line.slice(0, separator).trim(),
        description: line.slice(separator + 2).trim(),
      }
    })
}
