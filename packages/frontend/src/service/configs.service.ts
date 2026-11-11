import {CONFIG_REVISION_HEADER, SimConfig, SpecType, specTypesSchema, UpdateSimConfig} from "@sensor-sim/shared";
import {action, affects, createOptimisticStore, createSignal, refresh} from "solid-js";
import {api} from "../api";

export const [statusConfigsRevision, setStatusConfigsRevision] = createSignal<number>(0)

export function createSimConfigsApi() {

  const [revision, setRevision] = createSignal<number>(0)

  const [configs, setConfigs] = createOptimisticStore<SimConfig[]>(
    async () => {
      const response = await api.get<SimConfig[]>(`/configs`)
      const revision = Number(response.headers.get(CONFIG_REVISION_HEADER))
      setRevision(revision)
      return response.json()
    },
    []
  )

  const add = action(function* (label: string) {
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

    yield api.post<SimConfig>(`/configs`, {
      json: {label},
    })

    refresh(configs)
  })

  const remove = action(function* (id: number) {
    setConfigs((list) =>
      list.filter((config) => config.id !== id)
    )
    yield api.delete<SimConfig>(`/configs/${id}`)
    refresh(configs)
  })

  const startStop = action(
    function* (id: number, playing: boolean) {
      setConfigs((list) => {
        const config = list.find((config) => config.id === id)
        if (config) config.playing = true
      })
      yield api.put(playing ? `/configs/${id}/start` : `/configs/${id}/stop`).json()
      refresh(configs)
    }
  )

  const share = action(
    function* (id: number, share: boolean) {
      const config = configs.find((config) => config.id === id)
      if (config) affects(config, "shareToken") // no optimistic mutations, just mark pending
      yield api.post(share ? `/configs/${id}/share` : `/configs/${id}/unshare`)
      refresh(configs)
    }
  )

  const update = action(async function* (id: number, config: UpdateSimConfig) {
    console.log("Updating config", id, config)
    setConfigs((list) => {
      const currentConfig = list.find((config) => config.id === id)
      // set all values from config in current config
      if (currentConfig) Object.assign(currentConfig, config)
    })

    yield api.patch<SimConfig>(`/configs/${id}`, {
      json: config
    })
    console.log("Updated config", id, config)
    refresh(configs)
  })

  const updateType = action(async function* (id: number, type: SpecType | null) {
    const parsedType = specTypesSchema.safeParse(type).data ?? null

    const config = configs.find((config) => config.id === id)
    if (config) affects(config, "spec") // no optimistic mutations, just mark pending

    if (parsedType) {
      yield api.put<SimConfig>(`/configs/${id}/type`, {
        json: {type: parsedType}
      })
    } else {
      yield api.patch<SimConfig>(`/configs/${id}`, {
        json: {spec: null}
      })
    }

    refresh(configs)

  })

  const refreshConfigs = () => refresh(configs)

// export const fetchSimConfigs = query(async () => {
//   const response = await api.get<SimConfig[]>(`/configs`)
//   const revision = Number(response.headers.get(CONFIG_REVISION_HEADER))
//   setFetchedConfigsRevision(revision)
//   return response.json()
// }, "simConfigs");

// export const fetchSimConfig = query(async (id: number) => {
//   return api.get<SimConfig>(`/configs/${id}`).json()
// }, "simConfig");

  return {
    configs,
    revision,
    refreshConfigs,
    add,
    remove,
    startStop,
    update,
    updateType,
    share,
  }
}

let simConfigsApi: ReturnType<typeof createSimConfigsApi>

export function useSimConfigsApi() {

  if (!simConfigsApi) {
    simConfigsApi = createSimConfigsApi()
  }

  return simConfigsApi
}



