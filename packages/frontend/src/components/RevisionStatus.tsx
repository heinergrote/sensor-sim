import {jwtToken, useAuth} from "../auth";
import {serverUrl} from "../api";
import {StatusMessage} from "@sensor-sim/shared";
import {createEffect, createMemo, createSignal, onCleanup, Show} from "solid-js";
import {revalidate} from "@solidjs/router";
import {
  fetchedConfigsRevision,
  fetchSimConfigs,
  setStatusConfigsRevision,
  statusConfigsRevision
} from "../service/configs.service";
import {TbOutlineExclamationMark, TbOutlineRefresh} from "solid-icons/tb";

const RECONNECT_MIN_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 30000

export default function RevisionStatus() {

  const {user} = useAuth()
  const [connected, setConnected] = createSignal<boolean>(false)

  const refreshNeeded = createMemo(() => statusConfigsRevision() > fetchedConfigsRevision())

  let wss: WebSocket | undefined
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined

  createEffect(() => user(),
    (user) => {
      disconnect()
      if (user) connect()
    })

  function connect(reconnectDelay = RECONNECT_MIN_DELAY_MS, isReconnect = false) {
    const socket = new WebSocket(`${serverUrl}/api/status/ws?token=${jwtToken()}`)
    wss = socket

    socket.onopen = () => {
      setConnected(true)
    }

    socket.onmessage = (event) => {
      const statusMessage = JSON.parse(event.data) as StatusMessage
      setStatusConfigsRevision(statusMessage.configsRevision)
    }

    // the server closes it on restart; reconnect with backoff unless we closed it ourselves
    socket.onclose = () => {
      if (wss !== socket) return
      wss = undefined
      reconnectTimer = setTimeout(
        () => connect(Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS), true),
        reconnectDelay
      )
      setConnected(false)
    }
  }

  function disconnect() {
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
    const socket = wss
    wss = undefined // before close(), so its onclose doesn't reconnect
    socket?.close()
  }

  onCleanup(
    () => disconnect()
  )

  return <div>
    <Show when={connected()} fallback={<div class={"btn btn-square btn-error"}><TbOutlineExclamationMark/></div>}>
      {
        refreshNeeded() &&
        <button class={"btn btn-square btn-error"} onClick={() => revalidate(fetchSimConfigs.key)}>
          <TbOutlineRefresh/>
        </button>
      }
    </Show>
  </div>


}