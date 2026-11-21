import {getValidToken, isLoggedIn, useAuth} from "../auth";
import {serverUrl} from "../api";
import {StatusMessage} from "@sensor-sim/shared";
import {createEffect, createMemo, createSignal, onCleanup, Show} from "solid-js";
import {setStatusConfigsRevision, statusConfigsRevision, useSimConfigsApi} from "../service/configs.service";
import {TbOutlineExclamationMark, TbOutlineRefresh} from "solid-icons/tb";

const RECONNECT_MIN_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 30000

export default function RevisionStatus() {

  const api = useSimConfigsApi()

  const {user} = useAuth()
  const [connected, setConnected] = createSignal<boolean>(false)

  const refreshNeeded = createMemo(() => statusConfigsRevision() > api.revision())

  let wss: WebSocket | undefined
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  // bumped by disconnect(): a connect() still awaiting its token must not open a socket afterwards
  let connectGeneration = 0

  createEffect(() => user(),
    (user) => {
      disconnect()
      // the last revision seen belongs to the previous user's stream
      setStatusConfigsRevision(0)
      if (user) connect()
    })

  async function connect(reconnectDelay = RECONNECT_MIN_DELAY_MS) {
    const generation = connectGeneration
    // the access token is short-lived: get a fresh one for every (re)connect
    const token = await getValidToken()
    if (generation !== connectGeneration) return
    if (!token) {
      // no token although logged in = server unreachable: keep retrying with backoff
      if (isLoggedIn()) scheduleReconnect(reconnectDelay)
      return
    }

    const socket = new WebSocket(`${serverUrl}/api/status/ws?token=${token}`)
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
      scheduleReconnect(reconnectDelay)
      setConnected(false)
    }
  }

  function scheduleReconnect(reconnectDelay: number) {
    reconnectTimer = setTimeout(
      () => connect(Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS)),
      reconnectDelay
    )
  }

  function disconnect() {
    connectGeneration++
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
        <button class={"btn btn-square btn-error"} onClick={api.refreshConfigs}>
          <TbOutlineRefresh/>
        </button>
      }
    </Show>
  </div>


}