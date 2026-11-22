import {Session} from "@sensor-sim/shared";
import {createSignal, For} from "solid-js";
import {useNavigate} from "@solidjs/router";
import {TbOutlineLogout, TbOutlineX} from "solid-icons/tb";
import {useAuth} from "../../auth";
import {paths} from "../../router";

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
]

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad/, "iOS"],
  [/Android/, "Android"],
  [/Mac OS X/, "macOS"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
]

/** "Firefox on macOS" from a user agent; the raw string if nothing matches (e.g. curl) */
export function describeUserAgent(userAgent: string): string {
  const browser = BROWSERS.find(([re]) => re.test(userAgent))?.[1]
  const system = SYSTEMS.find(([re]) => re.test(userAgent))?.[1]
  if (browser && system) return `${browser} on ${system}`
  return browser ?? system ?? (userAgent || "unknown")
}

const formatDate = (iso: string) => new Date(iso).toLocaleString()

/**
 * `onRevoke(id)` ends another session: its next refresh fails, so that device is logged out within the access
 * token's lifetime (≤ 15 min). The current session's button logs out here instead (also revoking it).
 */
export function SessionList(props: { sessions: Session[], onRevoke: (id: number) => Promise<void> }) {

  const {logout} = useAuth()
  const navigate = useNavigate()
  const [revoking, setRevoking] = createSignal<number | null>(null)

  async function handleRevoke(session: Session) {
    if (session.current) {
      logout()
      navigate(paths())
      return
    }
    setRevoking(session.id)
    try {
      await props.onRevoke(session.id)
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div class="overflow-x-auto">
      <table class="table table-sm">
        <thead>
        <tr>
          <th>Session</th>
          <th>Last used</th>
          <th>Logged in</th>
          <th>Expires</th>
          <th/>
        </tr>
        </thead>
        <tbody>
        <For each={props.sessions} keyed={(session) => session.id}
             fallback={<tr>
               <td colspan={6} class="opacity-50">No active sessions</td>
             </tr>}>
          {(session) =>
            <tr>
              <td title={session().userAgent + " - " + session().ip}>
                {describeUserAgent(session().userAgent)}
                {session().current && <span class="badge badge-sm badge-primary ml-2">this device</span>}
              </td>
              <td>{formatDate(session().lastUsedAt)}</td>
              <td>{formatDate(session().createdAt)}</td>
              <td>{formatDate(session().expiresAt)}</td>
              <td class="text-right">
                {session().current
                  ? <button class="btn btn-xs" onClick={() => handleRevoke(session())}>
                    <TbOutlineLogout/> Log out
                  </button>
                  : <button class="btn btn-xs btn-error btn-outline" disabled={revoking() === session().id}
                            onClick={() => handleRevoke(session())}>
                    <TbOutlineX/> Revoke
                  </button>
                }
              </td>
            </tr>
          }
        </For>
        </tbody>
      </table>
    </div>
  )
}
