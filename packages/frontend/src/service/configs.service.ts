import {CONFIG_REVISION_HEADER, SimConfig, UpdateSimConfig} from "@sensor-sim/shared";
import {action, affects, createOptimisticStore, createRoot, createSignal, refresh} from "solid-js";
import {api} from "../api";
import {authSession} from "../auth";

export const [statusConfigsRevision, setStatusConfigsRevision] = createSignal<number>(0)

// Module-level, created on import. createRoot gives the store an owner that is never disposed: it lives as long
// as the page (owned by a component, it would die with it — e.g. on logout — and never refetch). No current owner
// exists while a module is evaluated, so the root is detached by construction. The async store is still lazy:
// it fetches when `configs` is first read.
const root = createRoot(() => {
  const [revision, setRevision] = createSignal<number>(0)

  const [configs, setConfigs] = createOptimisticStore<SimConfig[]>(
    async () => {
      // per user: refetch on every login, empty while logged out (the store is a module singleton)
      if (!authSession()) return []
      const response = await api.get<SimConfig[]>(`/configs`)
      const revision = Number(response.headers.get(CONFIG_REVISION_HEADER))
      setRevision(revision)
      return response.json()
    },
    []
  )

  return {revision, configs, setConfigs}
})

/** the caller's sim configs; `[]` while logged out, refetched on every login */
export const configs = root.configs
/** `X-Config-Revision` of the last fetched list (compare with `statusConfigsRevision`) */
export const configsRevision = root.revision
const setConfigs = root.setConfigs

export const refreshConfigs = () => refresh(configs)

export const addConfig = action(function* (label: string) {
  setConfigs((list) => {
    list.push({
      id: 0,
      label,
      ownerId: 0,
      shareToken: "",
      spec: null,
      playing: false,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  })

  const created: SimConfig = yield api.post(`/configs`, {
    json: {label},
  }).json<SimConfig>()

  refresh(configs)
  return created
})

export const removeConfig = action(function* (id: number) {
  setConfigs((list) =>
    list.filter((config) => config.id !== id)
  )
  yield api.delete<SimConfig>(`/configs/${id}`)
  refresh(configs)
})

export const startStopConfig = action(
  function* (id: number, playing: boolean) {
    setConfigs((list) => {
      const config = list.find((config) => config.id === id)
      if (config) config.playing = playing
    })
    yield api.put(playing ? `/configs/${id}/start` : `/configs/${id}/stop`).json()
    refresh(configs)
  }
)

export const shareConfig = action(
  function* (id: number, share: boolean) {
    const config = configs.find((config) => config.id === id)
    if (config) affects(config, "shareToken") // no optimistic mutations, just mark pending
    yield api.post(share ? `/configs/${id}/share` : `/configs/${id}/unshare`)
    refresh(configs)
  }
)

export const updateConfig = action(async function* (id: number, config: UpdateSimConfig) {
  setConfigs((list) => {
    const currentConfig = list.find((config) => config.id === id)
    // set all values from config in current config
    if (currentConfig) Object.assign(currentConfig, config)
  })

  yield api.patch<SimConfig>(`/configs/${id}`, {
    json: config
  })

  refresh(configs)
})

