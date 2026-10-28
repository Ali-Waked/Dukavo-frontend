import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type {
  AutomationAction,
  AutomationCondition,
  AutomationMeta,
  AutomationRule,
  AutomationRuleStatus,
  AutomationRun,
  AutomationRunStatus,
  AutomationTask,
  AutomationTaskStatus,
  AutomationTrigger,
} from '@/types/automation'

export interface AutomationRulePayload {
  name: string
  description?: string | null
  status?: AutomationRuleStatus
  trigger: AutomationTrigger
  store_id?: number | null
  cooldown_seconds?: number
  conditions: AutomationCondition[]
  actions: AutomationAction[]
}

export interface AutomationRuleListParams {
  page?: number
  per_page?: number
  search?: string
  status?: AutomationRuleStatus | ''
  trigger?: AutomationTrigger | ''
  store_id?: number | ''
}

export interface AutomationRunListParams {
  page?: number
  per_page?: number
  automation_rule_id?: number
  status?: AutomationRunStatus | ''
  trigger?: AutomationTrigger | ''
}

export interface AutomationTaskListParams {
  page?: number
  per_page?: number
  mine?: boolean
  automation_rule_id?: number
  status?: AutomationTaskStatus | ''
  assigned_to?: number
}

export function fetchAutomationMeta(): Promise<AutomationMeta> {
  return api.get<AutomationMeta>('/tenant/automation/meta')
}

export function fetchAutomationRules(
  params: AutomationRuleListParams = {},
): Promise<Paginated<AutomationRule>> {
  return api.list<AutomationRule>('/tenant/automation/rules', {
    ...(params as Record<string, unknown>),
  })
}

export function fetchAutomationRule(id: number): Promise<AutomationRule> {
  return api.get<AutomationRule>(`/tenant/automation/rules/${id}`)
}

export function createAutomationRule(payload: AutomationRulePayload): Promise<AutomationRule> {
  return api.post<AutomationRule>('/tenant/automation/rules', payload)
}

export function updateAutomationRule(
  id: number,
  payload: Partial<AutomationRulePayload>,
): Promise<AutomationRule> {
  return api.patch<AutomationRule>(`/tenant/automation/rules/${id}`, payload)
}

export function deleteAutomationRule(id: number): Promise<void> {
  return api.delete<void>(`/tenant/automation/rules/${id}`)
}

export function fetchAutomationRuns(
  params: AutomationRunListParams = {},
): Promise<Paginated<AutomationRun>> {
  return api.list<AutomationRun>('/tenant/automation/runs', {
    ...(params as Record<string, unknown>),
  })
}

export function fetchAutomationRun(id: number): Promise<AutomationRun> {
  return api.get<AutomationRun>(`/tenant/automation/runs/${id}`)
}

export function fetchAutomationTasks(
  params: AutomationTaskListParams = {},
): Promise<Paginated<AutomationTask>> {
  return api.list<AutomationTask>('/tenant/automation/tasks', {
    ...(params as Record<string, unknown>),
  })
}

export function fetchAutomationTask(id: number): Promise<AutomationTask> {
  return api.get<AutomationTask>(`/tenant/automation/tasks/${id}`)
}

export function updateAutomationTask(
  id: number,
  status: AutomationTaskStatus,
): Promise<AutomationTask> {
  return api.patch<AutomationTask>(`/tenant/automation/tasks/${id}`, { status })
}
