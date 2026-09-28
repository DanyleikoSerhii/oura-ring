import { liveQuery } from 'dexie'
import { onScopeDispose, ref, shallowRef, watch, type Ref, type WatchSource } from 'vue'

/** Реактивное чтение из Dexie: результат обновляется при изменении таблиц. */
export function useLive<T>(
  querier: () => Promise<T>,
  initial: T,
  deps: WatchSource[] = [],
): { data: Ref<T>; loading: Ref<boolean> } {
  const data = shallowRef(initial) as Ref<T>
  const loading = ref(true)
  let subscription: { unsubscribe: () => void } | undefined

  const start = () => {
    subscription?.unsubscribe()
    loading.value = true
    subscription = liveQuery(querier).subscribe({
      next: (value) => {
        data.value = value
        loading.value = false
      },
      error: (err) => {
        console.error(err)
        loading.value = false
      },
    })
  }

  start()
  if (deps.length) watch(deps, start)
  onScopeDispose(() => subscription?.unsubscribe())
  return { data, loading }
}
