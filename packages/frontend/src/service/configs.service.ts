import {CONFIG_REVISION_HEADER, SimConfig, SpecType, specTypesSchema, UpdateSimConfig} from "@sensor-sim/shared";
import {action, createSignal} from "solid-js";
import {api} from "../api";
import {formAction, query, revalidate} from "@solidjs/router";

export const [fetchedConfigsRevision, setFetchedConfigsRevision] = createSignal<number>(0)
export const [statusConfigsRevision, setStatusConfigsRevision] = createSignal<number>(0)

export const fetchSimConfigs = query(async () => {
  const response = await api.get<SimConfig[]>(`/configs`)
  const revision = Number(response.headers.get(CONFIG_REVISION_HEADER))
  setFetchedConfigsRevision(revision)
  return response.json()
}, "simConfigs");


export const fetchSimConfig = query(async (id: number) => {
  return api.get<SimConfig>(`/configs/${id}`).json()
}, "simConfig");


// Button-triggered mutations are router form actions, bound via <form action={...}> / formaction.
// The router revalidates queries after each one.

export const addSimConfig = formAction(async (form: FormData) => {

  return api.post<SimConfig>(`/configs`, {
    json: {
      label: form.get("label") as string
    }
  }).json()
})

export const deleteSimConfig = formAction(async (id: number) => {
  return api.delete<SimConfig>(`/configs/${id}`).json()
})

export const startSim = formAction(async (id: number) => {
  return api.put(`/configs/${id}/start`).json()
})

export const stopSim = formAction(async (id: number) => {
  return api.put(`/configs/${id}/stop`).json()
})

export const share = formAction(async (id: number) => {
  return api.post<{ token: string, expiryDate: Date }>(`/configs/${id}/share`).json()
})

export const unShare = formAction(async (id: number) => {
  return api.post<{ success: boolean }>(`/configs/${id}/unshare`).json()
})

// Mutations called from code (map drags, sliders, selects) are core actions: plain callables that know
// nothing about the router, so they revalidate the config list themselves.

export const updateSimConfig = action(async function* (id: number, config: UpdateSimConfig) {
  const result = await api.patch<SimConfig>(`/configs/${id}`, {
    json: config
  }).json()
  yield // re-enter the transaction before touching reactive state
  revalidate(fetchSimConfigs.key)
  return result
})

export const updateType = action(async function* (id: number, type: SpecType | null) {
  const parsedType = specTypesSchema.safeParse(type).data ?? null

  const result = parsedType
    // type valid: update using type endpoint
    ? await api.put<SimConfig>(`/configs/${id}/type`, {
      json: {type: parsedType}
    }).json()
    // type invalid: remove spec
    : await api.patch<SimConfig>(`/configs/${id}`, {
      json: {spec: null}
    }).json()
  yield // re-enter the transaction before touching reactive state
  revalidate(fetchSimConfigs.key)
  return result
})
