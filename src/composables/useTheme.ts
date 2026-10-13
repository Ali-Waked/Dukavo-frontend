import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/uiStore'

export function useTheme() {
  const store = useUiStore()
  return { ...storeToRefs(store), store }
}