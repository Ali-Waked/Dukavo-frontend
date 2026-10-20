/**
 * AI assistance types.
 *
 * These mirror the shapes the backend returns from the `ai` endpoints. Every
 * field is model-generated prose or a model-chosen label — nothing here is a
 * figure the server computed — so the UI treats all of it as a suggestion to be
 * reviewed, never as authoritative data.
 */

/** Token accounting returned alongside every completion. */
export interface AiUsage {
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

/** A draft reply for a support agent to edit and send themselves. */
export interface AiReplyDraft {
  draft: string
  tone: string
  suggestions: string[]
  usage: AiUsage
}

export type AiHighlightSeverity = 'positive' | 'neutral' | 'warning'

export interface AiHighlight {
  title: string
  detail: string
  severity: AiHighlightSeverity
}

export interface AiRecommendation {
  title: string
  detail: string
}

/**
 * A grounded briefing over already-computed dashboard aggregates.
 *
 * `data_gaps` lists the metrics the model was asked to call out as missing, so
 * a quiet period reads as "no data" rather than being glossed over.
 */
export interface AiInsights {
  summary: string
  highlights: AiHighlight[]
  recommendations: AiRecommendation[]
  data_gaps: string[]
  usage: AiUsage
}

export type AiNewsletterAction = 'outline' | 'draft' | 'improve'

/** Proposed newsletter content. The body is already sanitised server-side. */
export interface AiNewsletterContent {
  title: string
  excerpt: string
  body: string
  usage: AiUsage
}
