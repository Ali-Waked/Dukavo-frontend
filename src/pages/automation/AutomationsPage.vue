<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  Activity,
  CheckCircle2,
  Clock,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import type { BadgeTone } from '@/components/ui/badgeTones'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import BaseTabs, { type TabItem } from '@/components/ui/BaseTabs.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  createAutomationRule,
  deleteAutomationRule,
  fetchAutomationMeta,
  fetchAutomationRules,
  fetchAutomationRuns,
  fetchAutomationTasks,
  updateAutomationRule,
  updateAutomationTask,
} from '@/services/automationService'
import { fetchStores } from '@/services/storeService'
import type { Paginated } from '@/types/api'
import type {
  AutomationAction,
  AutomationActionConfig,
  AutomationActionType,
  AutomationCondition,
  AutomationMeta,
  AutomationRule,
  AutomationRuleStatus,
  AutomationRun,
  AutomationRunStatus,
  AutomationTask,
  AutomationTaskPriority,
  AutomationTaskStatus,
  AutomationTrigger,
  AutomationTriggerDefinition,
} from '@/types/automation'
import type { Store } from '@/types/catalogue'
import { formatDateTime, formatRelative } from '@/utils/format'

/**
 * Automations are expressed as data, never code.
 *
 * The editor renders its trigger fields, operators and action controls from the
 * server's meta endpoint, then submits the same shape the engine evaluates. A
 * rule is created paused until the merchant deliberately activates it.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const PER_PAGE = 15

const canManage = computed(() => auth.can('automation.manage'))

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof ApiError && caught.message ? caught.message : fallback
}

/* ---------------------------------------------------------------- meta */

const meta = ref<AutomationMeta | null>(null)
const stores = ref<Store[]>([])
const metaLoading = ref(true)

async function loadMeta(): Promise<void> {
  metaLoading.value = true

  try {
    const [definitions, storeList] = await Promise.all([
      fetchAutomationMeta(),
      fetchStores({ activeOnly: true }),
    ])
    meta.value = definitions
    stores.value = storeList
  } catch {
    // The list still works; the rule editor explains that definitions failed.
  } finally {
    metaLoading.value = false
  }
}

const triggerDefinitions = computed(() => meta.value?.triggers ?? [])

function triggerDefinition(key: string): AutomationTriggerDefinition | undefined {
  return triggerDefinitions.value.find((trigger) => trigger.key === key)
}

const storeOptions = computed(() => [
  { value: '', label: t('automation.allStores') },
  ...stores.value.map((store) => ({ value: String(store.id), label: store.name })),
])

/* ---------------------------------------------------------------- tabs */

const tab = ref<'rules' | 'runs' | 'tasks'>('rules')

const tabs = computed<TabItem[]>(() => [
  { key: 'rules', label: t('automation.rules') },
  { key: 'runs', label: t('automation.runs') },
  { key: 'tasks', label: t('automation.tasks') },
])

/* --------------------------------------------------------------- rules */

const rules = ref<AutomationRule[]>([])
const ruleMeta = ref<Paginated<AutomationRule>['meta'] | null>(null)
const rulesLoading = ref(true)
const rulesError = ref<string | null>(null)
const rulePage = ref(1)
const ruleSearch = ref('')
const debouncedRuleSearch = useDebounce(ruleSearch, 300)
const ruleStatus = ref('')
const ruleTrigger = ref('')
const togglingId = ref<number | null>(null)

const ruleColumns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('automation.rule') },
  { key: 'trigger', label: t('automation.trigger') },
  { key: 'store', label: t('common.store') },
  { key: 'status', label: t('common.status') },
  { key: 'last_run', label: t('automation.lastRun') },
  { key: 'actions', label: '', align: 'end', width: '72px' },
])

const ruleStatusOptions = computed(() => [
  { value: '', label: t('automation.allStatuses') },
  { value: 'active', label: t('automation.statusActive') },
  { value: 'paused', label: t('automation.statusPaused') },
])

const triggerOptions = computed(() => [
  { value: '', label: t('automation.allTriggers') },
  ...triggerDefinitions.value.map((trigger) => ({ value: trigger.key, label: trigger.label })),
])

async function loadRules(): Promise<void> {
  rulesLoading.value = true
  rulesError.value = null

  try {
    const result = await fetchAutomationRules({
      page: rulePage.value,
      per_page: PER_PAGE,
      search: debouncedRuleSearch.value || undefined,
      status: ruleStatus.value ? (ruleStatus.value as AutomationRuleStatus) : undefined,
      trigger: ruleTrigger.value ? (ruleTrigger.value as AutomationTrigger) : undefined,
    })
    rules.value = result.data
    ruleMeta.value = result.meta
  } catch (caught) {
    rulesError.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : errorMessage(caught, t('error.title'))
  } finally {
    rulesLoading.value = false
  }
}

function resetRuleFilters(): void {
  ruleSearch.value = ''
  ruleStatus.value = ''
  ruleTrigger.value = ''
  rulePage.value = 1
}

watch([debouncedRuleSearch, ruleStatus, ruleTrigger], () => {
  rulePage.value = 1
  if (tab.value === 'rules') void loadRules()
})

watch(rulePage, () => {
  if (tab.value === 'rules') void loadRules()
})

async function toggleRule(rule: AutomationRule): Promise<void> {
  togglingId.value = rule.id
  const next: AutomationRuleStatus = rule.status === 'active' ? 'paused' : 'active'

  try {
    await updateAutomationRule(rule.id, { status: next })
    toast.success(next === 'active' ? t('automation.activated') : t('automation.paused'))
    await loadRules()
  } catch (caught) {
    toast.error(errorMessage(caught, t('error.title')))
  } finally {
    togglingId.value = null
  }
}

/* --------------------------------------------------------------- runs */

const runs = ref<AutomationRun[]>([])
const runMeta = ref<Paginated<AutomationRun>['meta'] | null>(null)
const runsLoading = ref(true)
const runsError = ref<string | null>(null)
const runPage = ref(1)
const runStatus = ref('')
const runTrigger = ref('')

const runColumns = computed<TableColumn[]>(() => [
  { key: 'rule', label: t('automation.rule') },
  { key: 'trigger', label: t('automation.trigger') },
  { key: 'status', label: t('common.status') },
  { key: 'matched', label: t('automation.matched') },
  { key: 'started', label: t('automation.started') },
  { key: 'actions', label: '', align: 'end', width: '72px' },
])

const runStatusOptions = computed(() => [
  { value: '', label: t('automation.allStatuses') },
  { value: 'completed', label: t('automation.runCompleted') },
  { value: 'partial', label: t('automation.runPartial') },
  { value: 'failed', label: t('automation.runFailed') },
  { value: 'skipped', label: t('automation.runSkipped') },
  { value: 'running', label: t('automation.runRunning') },
])

async function loadRuns(): Promise<void> {
  runsLoading.value = true
  runsError.value = null

  try {
    const result = await fetchAutomationRuns({
      page: runPage.value,
      per_page: PER_PAGE,
      status: runStatus.value ? (runStatus.value as AutomationRunStatus) : undefined,
      trigger: runTrigger.value ? (runTrigger.value as AutomationTrigger) : undefined,
    })
    runs.value = result.data
    runMeta.value = result.meta
  } catch (caught) {
    runsError.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : errorMessage(caught, t('error.title'))
  } finally {
    runsLoading.value = false
  }
}

function resetRunFilters(): void {
  runStatus.value = ''
  runTrigger.value = ''
  runPage.value = 1
}

watch([runStatus, runTrigger], () => {
  runPage.value = 1
  if (tab.value === 'runs') void loadRuns()
})

watch(runPage, () => {
  if (tab.value === 'runs') void loadRuns()
})

const selectedRun = ref<AutomationRun | null>(null)
const runOpen = ref(false)

function openRun(run: AutomationRun): void {
  selectedRun.value = run
  runOpen.value = true
}

/* --------------------------------------------------------------- tasks */

const tasks = ref<AutomationTask[]>([])
const taskMeta = ref<Paginated<AutomationTask>['meta'] | null>(null)
const tasksLoading = ref(true)
const tasksError = ref<string | null>(null)
const taskPage = ref(1)
const taskStatus = ref('')
const taskMine = ref('')
const taskBusyId = ref<number | null>(null)

const taskColumns = computed<TableColumn[]>(() => [
  { key: 'task', label: t('automation.task') },
  { key: 'rule', label: t('automation.rule') },
  { key: 'assignee', label: t('automation.assignee') },
  { key: 'priority', label: t('automation.priority') },
  { key: 'status', label: t('common.status') },
  { key: 'due', label: t('automation.due') },
  { key: 'actions', label: '', align: 'end', width: '120px' },
])

const taskStatusOptions = computed(() => [
  { value: '', label: t('automation.allStatuses') },
  { value: 'open', label: t('automation.taskOpen') },
  { value: 'completed', label: t('automation.taskCompleted') },
  { value: 'dismissed', label: t('automation.taskDismissed') },
])

const taskScopeOptions = computed(() => [
  { value: '', label: t('automation.allAssignees') },
  { value: 'mine', label: t('automation.assignedToMe') },
])

async function loadTasks(): Promise<void> {
  tasksLoading.value = true
  tasksError.value = null

  try {
    const result = await fetchAutomationTasks({
      page: taskPage.value,
      per_page: PER_PAGE,
      status: taskStatus.value ? (taskStatus.value as AutomationTaskStatus) : undefined,
      mine: taskMine.value === 'mine' || undefined,
    })
    tasks.value = result.data
    taskMeta.value = result.meta
  } catch (caught) {
    tasksError.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : errorMessage(caught, t('error.title'))
  } finally {
    tasksLoading.value = false
  }
}

function resetTaskFilters(): void {
  taskStatus.value = ''
  taskMine.value = ''
  taskPage.value = 1
}

watch([taskStatus, taskMine], () => {
  taskPage.value = 1
  if (tab.value === 'tasks') void loadTasks()
})

watch(taskPage, () => {
  if (tab.value === 'tasks') void loadTasks()
})

async function setTaskStatus(task: AutomationTask, status: AutomationTaskStatus): Promise<void> {
  taskBusyId.value = task.id

  try {
    await updateAutomationTask(task.id, status)
    toast.success(
      status === 'completed' ? t('automation.taskCompletedToast') : t('automation.taskDismissedToast'),
    )
    await loadTasks()
  } catch (caught) {
    toast.error(errorMessage(caught, t('error.title')))
  } finally {
    taskBusyId.value = null
  }
}

watch(tab, (next) => {
  if (next === 'rules') void loadRules()
  if (next === 'runs') void loadRuns()
  if (next === 'tasks') void loadTasks()
})

/* --------------------------------------------------------------- editor */

interface FormCondition {
  field: string
  operator: string
  value: string
}

interface FormAction {
  type: AutomationActionType
  message: string
  title: string
  description: string
  priority: AutomationTaskPriority
  assigned_to: string
  due_in_days: string
  action_type: string
  summary: string
  payload: string
}

interface RuleForm {
  name: string
  description: string
  status: AutomationRuleStatus
  trigger: AutomationTrigger
  store_id: string
  cooldown_seconds: string
  conditions: FormCondition[]
  actions: FormAction[]
}

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

function blankCondition(): FormCondition {
  const trigger = triggerDefinition(form.trigger)
  return {
    field: trigger?.fields[0]?.key ?? '',
    operator: 'equals',
    value: '',
  }
}

function blankAction(type: AutomationActionType = 'notify_team'): FormAction {
  return {
    type,
    message: '',
    title: '',
    description: '',
    priority: 'normal',
    assigned_to: '',
    due_in_days: '',
    action_type: meta.value?.ai_action_types[0]?.action_type ?? '',
    summary: '',
    payload: '{}',
  }
}

function blankForm(): RuleForm {
  return {
    name: '',
    description: '',
    status: 'paused',
    trigger: (triggerDefinitions.value[0]?.key ?? 'order.created') as AutomationTrigger,
    store_id: '',
    cooldown_seconds: '0',
    conditions: [],
    actions: [blankAction()],
  }
}

const form = reactive<RuleForm>(blankForm())

const currentTrigger = computed(() => triggerDefinition(form.trigger))
const operatorDefinitions = computed(() => meta.value?.operators ?? [])

const fieldOptions = computed(() =>
  (currentTrigger.value?.fields ?? []).map((field) => ({ value: field.key, label: field.label })),
)

const operatorOptions = computed(() =>
  operatorDefinitions.value.map((operator) => ({ value: operator.value, label: operator.label })),
)

const actionDefinitions = computed(() => meta.value?.actions ?? [])
const actionTypeOptions = computed(() =>
  actionDefinitions.value.map((action) => ({ value: action.key, label: action.label })),
)

const aiActionTypeOptions = computed(() =>
  (meta.value?.ai_action_types ?? []).map((action) => ({
    value: action.action_type,
    label: `${action.action_type} · ${action.classification_label}`,
  })),
)

const priorityOptions = computed(() =>
  (meta.value?.task_priorities ?? ['low', 'normal', 'high', 'urgent']).map((priority) => ({
    value: priority,
    label: priorityLabel(priority),
  })),
)

function priorityLabel(priority: AutomationTaskPriority): string {
  switch (priority) {
    case 'low':
      return t('automation.priorityLow')
    case 'high':
      return t('automation.priorityHigh')
    case 'urgent':
      return t('automation.priorityUrgent')
    default:
      return t('automation.priorityNormal')
  }
}

function operatorDefinition(value: string) {
  return operatorDefinitions.value.find((operator) => operator.value === value)
}

function fieldDefinition(field: string) {
  return currentTrigger.value?.fields.find((candidate) => candidate.key === field)
}

function conditionValueOptions(condition: FormCondition) {
  return (fieldDefinition(condition.field)?.options ?? []).map((option) => ({
    value: option.value,
    label: option.label,
  }))
}

function actionDefinition(type: AutomationActionType) {
  return actionDefinitions.value.find((action) => action.key === type)
}

function resetForm(): void {
  Object.assign(form, blankForm())
  fieldErrors.value = {}
  formError.value = null
}

function openCreate(): void {
  editingId.value = null
  resetForm()
  formOpen.value = true
}

function openEdit(rule: AutomationRule): void {
  editingId.value = rule.id
  fieldErrors.value = {}
  formError.value = null

  Object.assign(form, {
    name: rule.name,
    description: rule.description ?? '',
    status: rule.status,
    trigger: rule.trigger,
    store_id: rule.store_id === null ? '' : String(rule.store_id),
    cooldown_seconds: String(rule.cooldown_seconds),
    conditions: (rule.conditions ?? []).map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: Array.isArray(condition.value)
        ? condition.value.join(', ')
        : condition.value === null || condition.value === undefined
          ? ''
          : String(condition.value),
    })),
    actions: (rule.actions ?? []).map((action) => formActionFromApi(action)),
  })

  formOpen.value = true
}

function formActionFromApi(action: AutomationAction): FormAction {
  const config: AutomationActionConfig = action.config ?? {}

  return {
    type: action.type,
    message: typeof config.message === 'string' ? config.message : '',
    title: typeof config.title === 'string' ? config.title : '',
    description: typeof config.description === 'string' ? config.description : '',
    priority: (config.priority ?? 'normal') as AutomationTaskPriority,
    assigned_to: config.assigned_to === null || config.assigned_to === undefined ? '' : String(config.assigned_to),
    due_in_days: config.due_in_days === null || config.due_in_days === undefined ? '' : String(config.due_in_days),
    action_type: typeof config.action_type === 'string' ? config.action_type : aiActionTypeOptions.value[0]?.value ?? '',
    summary: typeof config.summary === 'string' ? config.summary : '',
    payload: JSON.stringify(config.payload ?? {}, null, 2),
  }
}

function onTriggerChange(): void {
  form.conditions = []
}

function addCondition(): void {
  form.conditions.push(blankCondition())
}

function removeCondition(index: number): void {
  form.conditions.splice(index, 1)
}

function addAction(): void {
  form.actions.push(blankAction(actionTypeOptions.value[0]?.value as AutomationActionType | undefined))
}

function removeAction(index: number): void {
  form.actions.splice(index, 1)
}

function onActionTypeChange(action: FormAction): void {
  const defaults = blankAction(action.type)
  action.message = defaults.message
  action.title = defaults.title
  action.description = defaults.description
  action.priority = defaults.priority
  action.assigned_to = defaults.assigned_to
  action.due_in_days = defaults.due_in_days
  action.action_type = defaults.action_type
  action.summary = defaults.summary
  action.payload = defaults.payload
}

function actionError(index: number, field: string): string | undefined {
  return fieldErrors.value[`actions.${index}.config.${field}`]
}

function conditionError(index: number, field: string): string | undefined {
  return fieldErrors.value[`conditions.${index}.${field}`]
}

function parsePayload(action: FormAction): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(action.payload || '{}')
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function conditionPayload(condition: FormCondition): AutomationCondition {
  const definition = operatorDefinition(condition.operator)
  const field = fieldDefinition(condition.field)

  if (!definition?.needs_value) {
    return { field: condition.field, operator: condition.operator }
  }

  const values = condition.value
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '')

  const convert = (value: string): string | number => {
    if (field?.type === 'number' && value !== '' && Number.isFinite(Number(value))) {
      return Number(value)
    }
    return value
  }

  return {
    field: condition.field,
    operator: condition.operator,
    value: definition.multiple ? values.map(convert) : convert(values[0] ?? ''),
  }
}

function actionPayload(action: FormAction): AutomationAction {
  switch (action.type) {
    case 'create_task':
      return {
        type: action.type,
        config: {
          title: action.title.trim(),
          description: action.description.trim() || null,
          priority: action.priority,
          assigned_to: action.assigned_to ? Number(action.assigned_to) : null,
          due_in_days: action.due_in_days ? Number(action.due_in_days) : null,
        },
      }
    case 'propose_ai_action':
      return {
        type: action.type,
        config: {
          action_type: action.action_type,
          summary: action.summary.trim() || null,
          payload: parsePayload(action) ?? {},
        },
      }
    default:
      return {
        type: action.type,
        config: { message: action.message.trim() },
      }
  }
}

function validate(): boolean {
  fieldErrors.value = {}
  const errors: Record<string, string> = {}

  if (form.name.trim() === '') errors.name = t('validation.required')

  if (form.conditions.length > 20) errors.conditions = t('automation.tooManyConditions')

  form.conditions.forEach((condition, index) => {
    if (!condition.field) errors[`conditions.${index}.field`] = t('validation.required')
    if (!condition.operator) errors[`conditions.${index}.operator`] = t('validation.required')

    const operator = operatorDefinition(condition.operator)
    if (operator?.needs_value && condition.value.trim() === '') {
      errors[`conditions.${index}.value`] = t('automation.conditionNeedsValue')
    }
  })

  if (form.actions.length === 0) errors.actions = t('automation.needsAction')

  form.actions.forEach((action, index) => {
    if (action.type === 'notify_team' && action.message.trim() === '') {
      errors[`actions.${index}.config.message`] = t('validation.required')
    }

    if (action.type === 'create_task') {
      if (action.title.trim() === '') errors[`actions.${index}.config.title`] = t('validation.required')
      if (action.assigned_to && !Number.isFinite(Number(action.assigned_to))) {
        errors[`actions.${index}.config.assigned_to`] = t('validation.number')
      }
      if (action.due_in_days) {
        const days = Number(action.due_in_days)
        if (!Number.isInteger(days) || days < 1 || days > 365) {
          errors[`actions.${index}.config.due_in_days`] = t('automation.dueRange')
        }
      }
    }

    if (action.type === 'propose_ai_action') {
      if (!action.action_type) errors[`actions.${index}.config.action_type`] = t('validation.required')
      if (parsePayload(action) === null) {
        errors[`actions.${index}.config.payload`] = t('automation.invalidJson')
      }
    }
  })

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function save(): Promise<void> {
  if (!validate()) {
    formError.value = t('validation.fixFields')
    return
  }

  saving.value = true
  formError.value = null

  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    status: form.status,
    trigger: form.trigger,
    store_id: form.store_id ? Number(form.store_id) : null,
    cooldown_seconds: Math.max(0, Number.parseInt(form.cooldown_seconds, 10) || 0),
    conditions: form.conditions.map(conditionPayload),
    actions: form.actions.map(actionPayload),
  }

  try {
    if (editingId.value === null) {
      await createAutomationRule(payload)
      toast.success(t('automation.created'))
    } else {
      await updateAutomationRule(editingId.value, payload)
      toast.success(t('automation.updated'))
    }

    formOpen.value = false
    await loadRules()
  } catch (caught) {
    if (caught instanceof ApiError && caught.isValidation && caught.fields) {
      const flat: Record<string, string> = {}
      for (const [key, messages] of Object.entries(caught.fields)) {
        if (messages[0]) flat[key] = messages[0]
      }
      fieldErrors.value = flat
      formError.value = t('validation.fixFields')
    } else {
      formError.value = errorMessage(caught, t('error.title'))
    }
  } finally {
    saving.value = false
  }
}

/* --------------------------------------------------------------- delete */

const pendingDelete = ref<AutomationRule | null>(null)
const deleting = ref(false)

async function confirmDelete(): Promise<void> {
  const rule = pendingDelete.value
  if (!rule) return

  deleting.value = true
  try {
    await deleteAutomationRule(rule.id)
    toast.success(t('automation.deleted'))
    pendingDelete.value = null
    await loadRules()
  } catch (caught) {
    toast.error(errorMessage(caught, t('error.title')))
  } finally {
    deleting.value = false
  }
}

/* --------------------------------------------------------------- labels */

function ruleStatusTone(status: AutomationRuleStatus): BadgeTone {
  return status === 'active' ? 'success' : 'neutral'
}

function runStatusTone(status: AutomationRunStatus): BadgeTone {
  switch (status) {
    case 'completed':
      return 'success'
    case 'partial':
      return 'warning'
    case 'failed':
      return 'danger'
    case 'running':
      return 'info'
    default:
      return 'neutral'
  }
}

function taskStatusTone(status: AutomationTaskStatus): BadgeTone {
  switch (status) {
    case 'completed':
      return 'success'
    case 'open':
      return 'warning'
    default:
      return 'neutral'
  }
}

function matchedLabel(run: AutomationRun): string {
  if (run.matched) return t('automation.matched')
  if (run.status === 'skipped') return t('automation.notMatched')
  return '—'
}

onMounted(() => {
  void loadMeta()
  void loadRules()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('automation.title')" :description="t('automation.subtitle')">
      <template v-if="canManage" #actions>
        <BaseButton :icon="Plus" :disabled="metaLoading || !meta" @click="openCreate">
          {{ t('automation.newRule') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseTabs v-model="tab" :tabs="tabs" />

    <!-- ------------------------------------------------------------ rules -->
    <template v-if="tab === 'rules'">
      <div class="flex flex-wrap items-end gap-3">
        <BaseInput
          v-model="ruleSearch"
          type="search"
          class="w-full sm:w-72"
          :label="t('action.search')"
          :placeholder="t('automation.searchRules')"
        />

        <BaseSelect
          v-model="ruleStatus"
          class="w-44"
          :label="t('common.status')"
          :options="ruleStatusOptions"
        />

        <BaseSelect
          v-model="ruleTrigger"
          class="w-56"
          :label="t('automation.trigger')"
          :options="triggerOptions"
        />

        <BaseButton
          v-if="ruleSearch || ruleStatus || ruleTrigger"
          variant="ghost"
          @click="resetRuleFilters"
        >
          {{ t('action.clearAll') }}
        </BaseButton>

        <BaseButton variant="secondary" :icon="RefreshCw" :loading="rulesLoading" @click="loadRules">
          {{ t('action.refresh') }}
        </BaseButton>
      </div>

      <BaseAlert v-if="rulesError" tone="danger">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span>{{ rulesError }}</span>
          <BaseButton size="sm" variant="secondary" @click="loadRules">
            {{ t('action.retry') }}
          </BaseButton>
        </div>
      </BaseAlert>

      <div class="surface overflow-hidden">
        <BaseTable :columns="ruleColumns" :loading="rulesLoading" :rows="rules">
          <tr v-for="rule in rules" :key="rule.id">
            <td class="px-4 py-3">
              <p class="font-medium text-ink">{{ rule.name }}</p>
              <p v-if="rule.description" class="mt-0.5 line-clamp-1 text-caption text-subtle">
                {{ rule.description }}
              </p>
            </td>

            <td class="px-4 py-3 text-muted">{{ rule.trigger_label }}</td>

            <td class="px-4 py-3 text-muted">
              {{ rule.store?.name ?? t('automation.allStores') }}
            </td>

            <td class="px-4 py-3">
              <BaseBadge :tone="ruleStatusTone(rule.status)" dot>{{ rule.status_label }}</BaseBadge>
            </td>

            <td class="px-4 py-3">
              <p class="text-ink">
                {{ rule.last_triggered_at ? formatRelative(rule.last_triggered_at) : t('automation.neverRun') }}
              </p>
              <p class="mt-0.5 text-caption text-subtle">
                {{ t('automation.runCount', { count: rule.run_count }) }}
              </p>
            </td>

            <td class="px-4 py-3">
              <div class="flex justify-end gap-1">
                <BaseButton
                  v-if="canManage"
                  size="sm"
                  variant="ghost"
                  :icon="rule.status === 'active' ? Clock : Play"
                  :loading="togglingId === rule.id"
                  :aria-label="rule.status === 'active' ? t('automation.pause') : t('automation.activate')"
                  @click="toggleRule(rule)"
                />

                <BaseButton
                  v-if="canManage"
                  size="sm"
                  variant="ghost"
                  :icon="Pencil"
                  :aria-label="t('action.edit')"
                  @click="openEdit(rule)"
                />

                <BaseButton
                  v-if="canManage"
                  size="sm"
                  variant="ghost"
                  :icon="Trash2"
                  :aria-label="t('action.delete')"
                  @click="pendingDelete = rule"
                />
              </div>
            </td>
          </tr>

          <template #empty>
            <BaseEmptyState
              v-if="rules.length === 0 && (ruleSearch || ruleStatus || ruleTrigger)"
              :icon="Activity"
              :title="t('automation.emptyRulesSearchTitle')"
              :description="t('automation.emptyRulesSearchBody')"
            >
              <template #action>
                <BaseButton variant="secondary" @click="resetRuleFilters">
                  {{ t('action.clearAll') }}
                </BaseButton>
              </template>
            </BaseEmptyState>

            <BaseEmptyState
              v-else-if="rules.length === 0"
              :icon="Activity"
              :title="t('automation.emptyRulesTitle')"
              :description="t('automation.emptyRulesBody')"
            >
              <template v-if="canManage" #action>
                <BaseButton :icon="Plus" :disabled="metaLoading || !meta" @click="openCreate">
                  {{ t('automation.newRule') }}
                </BaseButton>
              </template>
            </BaseEmptyState>
          </template>

          <template #footer>
            <BasePagination v-if="ruleMeta" :meta="ruleMeta" :disabled="rulesLoading" @change="rulePage = $event" />
          </template>
        </BaseTable>
      </div>
    </template>

    <!-- ------------------------------------------------------------- runs -->
    <template v-if="tab === 'runs'">
      <div class="flex flex-wrap items-end gap-3">
        <BaseSelect
          v-model="runStatus"
          class="w-48"
          :label="t('common.status')"
          :options="runStatusOptions"
        />

        <BaseSelect
          v-model="runTrigger"
          class="w-56"
          :label="t('automation.trigger')"
          :options="triggerOptions"
        />

        <BaseButton
          v-if="runStatus || runTrigger"
          variant="ghost"
          @click="resetRunFilters"
        >
          {{ t('action.clearAll') }}
        </BaseButton>

        <BaseButton variant="secondary" :icon="RefreshCw" :loading="runsLoading" @click="loadRuns">
          {{ t('action.refresh') }}
        </BaseButton>
      </div>

      <BaseAlert v-if="runsError" tone="danger">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span>{{ runsError }}</span>
          <BaseButton size="sm" variant="secondary" @click="loadRuns">
            {{ t('action.retry') }}
          </BaseButton>
        </div>
      </BaseAlert>

      <div class="surface overflow-hidden">
        <BaseTable :columns="runColumns" :loading="runsLoading" :rows="runs">
          <tr v-for="run in runs" :key="run.id" class="cursor-pointer" @click="openRun(run)">
            <td class="px-4 py-3">
              <p class="font-medium text-ink">{{ run.rule?.name ?? `#${run.automation_rule_id}` }}</p>
              <p class="mt-0.5 line-clamp-1 text-caption text-subtle">{{ run.event_key }}</p>
            </td>

            <td class="px-4 py-3 text-muted">{{ run.trigger_label }}</td>

            <td class="px-4 py-3">
              <BaseBadge :tone="runStatusTone(run.status)" dot>{{ run.status_label }}</BaseBadge>
            </td>

            <td class="px-4 py-3 text-muted">{{ matchedLabel(run) }}</td>

            <td class="px-4 py-3 text-muted">{{ formatDateTime(run.started_at) }}</td>

            <td class="px-4 py-3 text-end">
              <BaseButton size="sm" variant="ghost" :aria-label="t('action.viewDetails')" @click.stop="openRun(run)">
                {{ t('action.view') }}
              </BaseButton>
            </td>
          </tr>

          <template #empty>
            <BaseEmptyState
              :icon="Clock"
              :title="t('automation.emptyRunsTitle')"
              :description="t('automation.emptyRunsBody')"
            />
          </template>

          <template #footer>
            <BasePagination v-if="runMeta" :meta="runMeta" :disabled="runsLoading" @change="runPage = $event" />
          </template>
        </BaseTable>
      </div>
    </template>

    <!-- ------------------------------------------------------------ tasks -->
    <template v-if="tab === 'tasks'">
      <div class="flex flex-wrap items-end gap-3">
        <BaseSelect
          v-model="taskStatus"
          class="w-48"
          :label="t('common.status')"
          :options="taskStatusOptions"
        />

        <BaseSelect
          v-model="taskMine"
          class="w-48"
          :label="t('automation.assignee')"
          :options="taskScopeOptions"
        />

        <BaseButton
          v-if="taskStatus || taskMine"
          variant="ghost"
          @click="resetTaskFilters"
        >
          {{ t('action.clearAll') }}
        </BaseButton>

        <BaseButton variant="secondary" :icon="RefreshCw" :loading="tasksLoading" @click="loadTasks">
          {{ t('action.refresh') }}
        </BaseButton>
      </div>

      <BaseAlert v-if="tasksError" tone="danger">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span>{{ tasksError }}</span>
          <BaseButton size="sm" variant="secondary" @click="loadTasks">
            {{ t('action.retry') }}
          </BaseButton>
        </div>
      </BaseAlert>

      <div class="surface overflow-hidden">
        <BaseTable :columns="taskColumns" :loading="tasksLoading" :rows="tasks">
          <tr v-for="task in tasks" :key="task.id">
            <td class="px-4 py-3">
              <p class="font-medium text-ink">{{ task.title }}</p>
              <p v-if="task.description" class="mt-0.5 line-clamp-1 text-caption text-subtle">
                {{ task.description }}
              </p>
            </td>

            <td class="px-4 py-3 text-muted">{{ task.rule?.name ?? '—' }}</td>

            <td class="px-4 py-3 text-muted">
              {{ task.assignee?.name ?? t('automation.unassigned') }}
            </td>

            <td class="px-4 py-3">
              <BaseBadge :tone="task.priority === 'urgent' || task.priority === 'high' ? 'warning' : 'neutral'">
                {{ priorityLabel(task.priority) }}
              </BaseBadge>
            </td>

            <td class="px-4 py-3">
              <BaseBadge :tone="taskStatusTone(task.status)" dot>{{ task.status_label }}</BaseBadge>
            </td>

            <td class="px-4 py-3 text-muted">
              {{ task.due_at ? formatDateTime(task.due_at) : t('automation.noDue') }}
            </td>

            <td class="px-4 py-3">
              <div v-if="task.status === 'open'" class="flex justify-end gap-1">
                <BaseButton
                  size="sm"
                  variant="secondary"
                  :icon="CheckCircle2"
                  :loading="taskBusyId === task.id"
                  @click="setTaskStatus(task, 'completed')"
                >
                  {{ t('automation.complete') }}
                </BaseButton>

                <BaseButton
                  size="sm"
                  variant="ghost"
                  :disabled="taskBusyId === task.id"
                  @click="setTaskStatus(task, 'dismissed')"
                >
                  {{ t('automation.dismiss') }}
                </BaseButton>
              </div>

              <p v-else class="text-end text-caption text-subtle">
                {{ task.completed_at ? formatDateTime(task.completed_at) : '—' }}
              </p>
            </td>
          </tr>

          <template #empty>
            <BaseEmptyState
              :icon="CheckCircle2"
              :title="t('automation.emptyTasksTitle')"
              :description="t('automation.emptyTasksBody')"
            />
          </template>

          <template #footer>
            <BasePagination v-if="taskMeta" :meta="taskMeta" :disabled="tasksLoading" @change="taskPage = $event" />
          </template>
        </BaseTable>
      </div>
    </template>

    <!-- ------------------------------------------------------------ editor -->
    <BaseModal
      :open="formOpen"
      :title="editingId === null ? t('automation.createRuleTitle') : t('automation.editRuleTitle')"
      size="xl"
      @close="formOpen = false"
    >
      <form class="space-y-6" @submit.prevent="save">
        <BaseAlert v-if="formError" tone="danger">{{ formError }}</BaseAlert>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="form.name"
            :label="t('automation.name')"
            required
            :error="fieldErrors.name"
          />

          <BaseSelect
            v-model="form.status"
            :label="t('common.status')"
            :options="[
              { value: 'paused', label: t('automation.statusPaused') },
              { value: 'active', label: t('automation.statusActive') },
            ]"
            :hint="t('automation.statusHint')"
            :error="fieldErrors.status"
          />

          <BaseSelect
            v-model="form.trigger"
            :label="t('automation.trigger')"
            :options="triggerOptions.filter((option) => option.value !== '')"
            :error="fieldErrors.trigger"
            @update:model-value="onTriggerChange"
          />

          <BaseSelect
            v-model="form.store_id"
            :label="t('common.store')"
            :options="storeOptions"
            :hint="t('automation.storeHint')"
            :error="fieldErrors.store_id"
          />

          <BaseInput
            v-model="form.cooldown_seconds"
            type="number"
            min="0"
            :label="t('automation.cooldown')"
            :hint="t('automation.cooldownHint')"
            :error="fieldErrors.cooldown_seconds"
          />

          <BaseTextarea
            v-model="form.description"
            :label="t('automation.description')"
            :placeholder="t('automation.descriptionPlaceholder')"
            :rows="3"
            :error="fieldErrors.description"
          />
        </div>

        <!-- conditions -->
        <section class="space-y-3">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 class="text-h4 font-semibold text-ink">{{ t('automation.conditions') }}</h3>
              <p class="mt-1 text-small text-muted">{{ t('automation.conditionsHint') }}</p>
            </div>

            <BaseButton size="sm" variant="secondary" :icon="Plus" @click="addCondition">
              {{ t('automation.addCondition') }}
            </BaseButton>
          </div>

          <BaseAlert v-if="fieldErrors.conditions" tone="danger">{{ fieldErrors.conditions }}</BaseAlert>

          <div
            v-if="form.conditions.length === 0"
            class="rounded-lg border border-dashed border-line bg-surface-2/50 px-4 py-5 text-center text-small text-muted"
          >
            {{ t('automation.noConditions') }}
          </div>

          <div
            v-for="(condition, index) in form.conditions"
            :key="index"
            class="grid grid-cols-1 gap-3 rounded-lg border border-line p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <BaseSelect
              v-model="condition.field"
              :label="t('automation.field')"
              :options="fieldOptions"
              :error="conditionError(index, 'field')"
            />

            <BaseSelect
              v-model="condition.operator"
              :label="t('automation.operator')"
              :options="operatorOptions"
              :error="conditionError(index, 'operator')"
            />

            <template v-if="operatorDefinition(condition.operator)?.needs_value">
              <BaseSelect
                v-if="conditionValueOptions(condition).length > 0 && !operatorDefinition(condition.operator)?.multiple"
                v-model="condition.value"
                :label="t('automation.value')"
                :options="conditionValueOptions(condition)"
                :placeholder="t('automation.chooseValue')"
                :hint="operatorDefinition(condition.operator)?.multiple ? t('automation.multipleValuesHint') : undefined"
                :error="conditionError(index, 'value')"
              />

              <BaseInput
                v-else
                v-model="condition.value"
                :label="t('automation.value')"
                :type="fieldDefinition(condition.field)?.type === 'number' ? 'number' : 'text'"
                :hint="operatorDefinition(condition.operator)?.multiple ? t('automation.multipleValuesHint') : undefined"
                :error="conditionError(index, 'value')"
              />
            </template>

            <div v-else class="hidden sm:block" />

            <div class="flex items-end justify-end pb-1">
              <BaseButton
                size="sm"
                variant="ghost"
                :icon="Trash2"
                :aria-label="t('automation.removeCondition')"
                @click="removeCondition(index)"
              />
            </div>
          </div>
        </section>

        <!-- actions -->
        <section class="space-y-3">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 class="text-h4 font-semibold text-ink">{{ t('automation.actionsTitle') }}</h3>
              <p class="mt-1 text-small text-muted">{{ t('automation.actionsHint') }}</p>
            </div>

            <BaseButton size="sm" variant="secondary" :icon="Plus" @click="addAction">
              {{ t('automation.addAction') }}
            </BaseButton>
          </div>

          <BaseAlert v-if="fieldErrors.actions" tone="danger">{{ fieldErrors.actions }}</BaseAlert>

          <div
            v-for="(action, index) in form.actions"
            :key="index"
            class="space-y-4 rounded-lg border border-line p-4"
          >
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <BaseSelect
                v-model="action.type"
                :label="t('automation.action')"
                :options="actionTypeOptions"
                :hint="actionDefinition(action.type)?.description"
                @update:model-value="onActionTypeChange(action)"
              />

              <BaseButton
                size="sm"
                variant="ghost"
                :icon="Trash2"
                :aria-label="t('automation.removeAction')"
                @click="removeAction(index)"
              />
            </div>

            <template v-if="action.type === 'notify_team'">
              <BaseTextarea
                v-model="action.message"
                :label="t('automation.notifyMessage')"
                :hint="t('automation.templateHint')"
                :rows="3"
                :error="actionError(index, 'message')"
              />
            </template>

            <template v-else-if="action.type === 'create_task'">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BaseInput
                  v-model="action.title"
                  :label="t('automation.taskTitle')"
                  :hint="t('automation.templateHint')"
                  required
                  :error="actionError(index, 'title')"
                />

                <BaseSelect
                  v-model="action.priority"
                  :label="t('automation.priority')"
                  :options="priorityOptions"
                  :error="actionError(index, 'priority')"
                />

                <BaseInput
                  v-model="action.assigned_to"
                  type="number"
                  min="1"
                  :label="t('automation.assigneeId')"
                  :hint="t('automation.assigneeHint')"
                  :error="actionError(index, 'assigned_to')"
                />

                <BaseInput
                  v-model="action.due_in_days"
                  type="number"
                  min="1"
                  max="365"
                  :label="t('automation.dueInDays')"
                  :error="actionError(index, 'due_in_days')"
                />
              </div>

              <BaseTextarea
                v-model="action.description"
                :label="t('automation.taskDescription')"
                :hint="t('automation.templateHint')"
                :rows="3"
                :error="actionError(index, 'description')"
              />
            </template>

            <template v-else-if="action.type === 'propose_ai_action'">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BaseSelect
                  v-model="action.action_type"
                  :label="t('automation.aiActionType')"
                  :options="aiActionTypeOptions"
                  :error="actionError(index, 'action_type')"
                />

                <BaseInput
                  v-model="action.summary"
                  :label="t('automation.aiSummary')"
                  :hint="t('automation.templateHint')"
                  :error="actionError(index, 'summary')"
                />
              </div>

              <BaseTextarea
                v-model="action.payload"
                :label="t('automation.aiPayload')"
                :hint="t('automation.aiPayloadHint')"
                :rows="6"
                :error="actionError(index, 'payload')"
                dir="ltr"
                class="font-mono"
              />
            </template>
          </div>
        </section>

        <div class="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <BaseButton variant="secondary" @click="formOpen = false">{{ t('action.cancel') }}</BaseButton>
          <BaseButton type="submit" :loading="saving">{{ t('action.save') }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- ------------------------------------------------------------- run detail -->
    <BaseModal
      :open="runOpen"
      :title="t('automation.runDetail')"
      size="lg"
      @close="runOpen = false"
    >
      <div v-if="selectedRun" class="space-y-5">
        <div class="flex flex-wrap items-center gap-2">
          <BaseBadge :tone="runStatusTone(selectedRun.status)" dot>
            {{ selectedRun.status_label }}
          </BaseBadge>
          <span class="text-small text-muted">{{ selectedRun.trigger_label }}</span>
          <span class="text-small text-subtle">·</span>
          <span class="font-mono text-caption text-subtle">{{ selectedRun.event_key }}</span>
        </div>

        <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-caption font-semibold uppercase tracking-wide text-muted">
              {{ t('automation.rule') }}
            </dt>
            <dd class="mt-0.5 text-ink">{{ selectedRun.rule?.name ?? `#${selectedRun.automation_rule_id}` }}</dd>
          </div>
          <div>
            <dt class="text-caption font-semibold uppercase tracking-wide text-muted">
              {{ t('automation.matched') }}
            </dt>
            <dd class="mt-0.5 text-ink">{{ matchedLabel(selectedRun) }}</dd>
          </div>
          <div>
            <dt class="text-caption font-semibold uppercase tracking-wide text-muted">
              {{ t('automation.started') }}
            </dt>
            <dd class="mt-0.5 text-ink">{{ formatDateTime(selectedRun.started_at) }}</dd>
          </div>
          <div>
            <dt class="text-caption font-semibold uppercase tracking-wide text-muted">
              {{ t('automation.finished') }}
            </dt>
            <dd class="mt-0.5 text-ink">{{ formatDateTime(selectedRun.finished_at) }}</dd>
          </div>
        </dl>

        <BaseAlert v-if="selectedRun.error" :tone="selectedRun.status === 'skipped' ? 'info' : 'danger'">
          <p class="font-medium">{{ t('automation.error') }}</p>
          <p class="mt-1 break-words">{{ selectedRun.error }}</p>
        </BaseAlert>

        <section v-if="selectedRun.actions.length > 0" class="space-y-2">
          <h4 class="text-h4 font-semibold text-ink">{{ t('automation.actionsResult') }}</h4>

          <div
            v-for="result in selectedRun.actions"
            :key="result.index"
            class="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-line p-3"
          >
            <div>
              <p class="text-sm font-medium text-ink">{{ result.summary }}</p>
              <p class="mt-0.5 font-mono text-caption text-subtle">{{ result.type }}</p>
            </div>
            <BaseBadge :tone="result.status === 'completed' ? 'success' : 'danger'" dot>
              {{ result.status }}
            </BaseBadge>
          </div>
        </section>

        <section class="space-y-2">
          <h4 class="text-h4 font-semibold text-ink">{{ t('automation.context') }}</h4>
          <pre
            class="max-h-72 overflow-auto rounded-lg bg-surface-2 p-3 text-caption text-ink"
            dir="ltr"
          >{{ JSON.stringify(selectedRun.context, null, 2) }}</pre>
        </section>
      </div>
    </BaseModal>

    <!-- ------------------------------------------------------------- delete -->
    <BaseModal
      :open="pendingDelete !== null"
      :title="t('automation.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-body text-muted">
        {{ t('automation.deleteBody', { name: pendingDelete?.name ?? '' }) }}
      </p>

      <div class="mt-6 flex justify-end gap-2">
        <BaseButton variant="secondary" @click="pendingDelete = null">{{ t('action.cancel') }}</BaseButton>
        <BaseButton variant="danger" :loading="deleting" @click="confirmDelete">
          {{ t('action.delete') }}
        </BaseButton>
      </div>
    </BaseModal>
  </div>
</template>
