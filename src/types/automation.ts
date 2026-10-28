/**
 * Automation rules, execution history and human follow-up tasks.
 *
 * The server owns the trigger/field/action catalogue and returns it from the
 * meta endpoint. These types mirror only the closed vocabulary; the editor
 * renders its controls from the returned definitions so a newly supported
 * field does not require a second frontend release.
 */

export type AutomationRuleStatus = 'active' | 'paused'

export type AutomationRunStatus = 'running' | 'completed' | 'partial' | 'failed' | 'skipped'

export type AutomationTaskStatus = 'open' | 'completed' | 'dismissed'

export type AutomationActionType = 'notify_team' | 'create_task' | 'propose_ai_action'

export type AutomationTaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export type AutomationTrigger =
  | 'order.created'
  | 'order.status_changed'
  | 'inventory.low_stock'
  | 'conversation.message_received'
  | 'recovery.opportunity_detected'

export type AutomationConditionValue = string | number | boolean | null | Array<string | number>

export interface AutomationCondition {
  field: string
  operator: string
  value?: AutomationConditionValue
}

export interface AutomationActionConfig {
  message?: string
  title?: string
  description?: string | null
  priority?: AutomationTaskPriority
  assigned_to?: number | string | null
  due_in_days?: number | string | null
  action_type?: string
  summary?: string | null
  payload?: Record<string, unknown>
}

export interface AutomationAction {
  type: AutomationActionType
  config: AutomationActionConfig
}

export interface AutomationRule {
  id: number
  store_id: number | null
  name: string
  description: string | null
  status: AutomationRuleStatus
  status_label: string
  trigger: AutomationTrigger
  trigger_label: string
  conditions: AutomationCondition[]
  actions: AutomationAction[]
  cooldown_seconds: number
  run_count: number
  last_triggered_at: string | null
  store?: { id: number; name: string } | null
  creator?: { id: number; name: string } | null
  latest_run?: AutomationRun | null
  created_at: string | null
  updated_at: string | null
}

export interface AutomationRunAction {
  index: number
  type: string
  status: 'completed' | 'failed'
  summary: string
  data?: Record<string, unknown>
}

export interface AutomationRun {
  id: number
  automation_rule_id: number
  trigger: AutomationTrigger
  trigger_label: string
  event_key: string
  status: AutomationRunStatus
  status_label: string
  matched: boolean
  context: Record<string, unknown>
  actions: AutomationRunAction[]
  error: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string | null
  rule?: { id: number; name: string } | null
}

export interface AutomationTask {
  id: number
  automation_rule_id: number
  automation_run_id: number | null
  store_id: number | null
  assigned_to: number | null
  created_by: number | null
  completed_by: number | null
  title: string
  description: string | null
  priority: AutomationTaskPriority
  status: AutomationTaskStatus
  status_label: string
  entity_type: string | null
  entity_id: number | null
  metadata: Record<string, unknown>
  due_at: string | null
  completed_at: string | null
  rule?: { id: number; name: string } | null
  store?: { id: number; name: string } | null
  assignee?: { id: number; name: string } | null
  creator?: { id: number; name: string } | null
  completer?: { id: number; name: string } | null
  created_at: string | null
  updated_at: string | null
}

export interface AutomationFieldOption {
  value: string
  label: string
}

export interface AutomationTriggerField {
  key: string
  label: string
  type: 'string' | 'number'
  options?: AutomationFieldOption[]
}

export interface AutomationTriggerDefinition {
  key: AutomationTrigger
  label: string
  fields: AutomationTriggerField[]
}

export interface AutomationOperatorDefinition {
  value: string
  label: string
  multiple: boolean
  needs_value: boolean
}

export interface AutomationActionField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'json'
  required: boolean
}

export interface AutomationActionDefinition {
  key: AutomationActionType
  label: string
  description: string
  config_fields: AutomationActionField[]
}

export interface AutomationAiActionType {
  action_type: string
  permission: string
  classification: string
  classification_label: string
}

export interface AutomationMeta {
  triggers: AutomationTriggerDefinition[]
  operators: AutomationOperatorDefinition[]
  actions: AutomationActionDefinition[]
  task_priorities: AutomationTaskPriority[]
  ai_action_types: AutomationAiActionType[]
}
