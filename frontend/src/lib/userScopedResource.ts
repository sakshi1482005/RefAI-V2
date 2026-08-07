export type UserScopedResourceState<T> = {
  userId: string | null
  data: T
  loading: boolean
  loaded: boolean
  notFound: boolean
  error: unknown
}

type Entry<T> = {
  state: UserScopedResourceState<T>
  listeners: Set<() => void>
  generation: number
  inFlight: Promise<void> | null
  controller: AbortController | null
}

export function createUserScopedResource<T>(emptyData: () => T) {
  const entries = new Map<string, Entry<T>>()
  let activeUserId: string | null = null

  const createEntry = (userId: string): Entry<T> => ({
    state: { userId, data: emptyData(), loading: false, loaded: false, notFound: false, error: null },
    listeners: new Set(),
    generation: 0,
    inFlight: null,
    controller: null,
  })

  const entryFor = (userId: string) => {
    const existing = entries.get(userId)
    if (existing) return existing
    const created = createEntry(userId)
    entries.set(userId, created)
    return created
  }

  const publish = (entry: Entry<T>, next: UserScopedResourceState<T>) => {
    entry.state = next
    entry.listeners.forEach((listener) => listener())
  }

  const clear = (userId: string) => {
    const entry = entries.get(userId)
    if (!entry) return
    entry.generation += 1
    entry.controller?.abort()
    entry.listeners.forEach((listener) => listener())
    entries.delete(userId)
  }

  const activate = (userId: string | null) => {
    if (activeUserId === userId) return
    if (activeUserId) clear(activeUserId)
    activeUserId = userId
    if (userId) entryFor(userId)
  }

  const getSnapshot = (userId: string) => entryFor(userId).state
  const subscribe = (userId: string, listener: () => void) => {
    const entry = entryFor(userId)
    entry.listeners.add(listener)
    return () => entry.listeners.delete(listener)
  }

  const seed = (userId: string, data: T) => {
    const entry = entryFor(userId)
    if (entry.state.loaded || entry.state.loading) return
    publish(entry, { ...entry.state, data })
  }

  const setData = (userId: string, data: T) => {
    const entry = entryFor(userId)
    entry.generation += 1
    entry.controller?.abort()
    entry.controller = null
    entry.inFlight = null
    publish(entry, { userId, data, loading: false, loaded: true, notFound: false, error: null })
  }

  const load = (userId: string, loader: (signal: AbortSignal) => Promise<T>, force = false) => {
    const entry = entryFor(userId)
    if (entry.inFlight && !force) return entry.inFlight
    if (entry.state.loaded && !force) return Promise.resolve()
    if (force) entry.controller?.abort()
    const generation = ++entry.generation
    const controller = new AbortController()
    entry.controller = controller
    publish(entry, { ...entry.state, loading: true, notFound: false, error: null })

    const request = loader(controller.signal)
      .then((data) => {
        if (entry.generation !== generation || controller.signal.aborted) return
        publish(entry, { userId, data, loading: false, loaded: true, notFound: false, error: null })
      })
      .catch((error: unknown) => {
        if (entry.generation !== generation || controller.signal.aborted) return
        const status = typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: unknown }).status : undefined
        publish(entry, {
          ...entry.state,
          loading: false,
          loaded: true,
          notFound: status === 404,
          error: status === 404 ? null : error,
          data: status === 404 ? emptyData() : entry.state.data,
        })
      })
      .finally(() => {
        if (entry.generation === generation) {
          entry.inFlight = null
          entry.controller = null
        }
      })
    entry.inFlight = request
    return request
  }

  return { activate, clear, getSnapshot, subscribe, seed, setData, load }
}
