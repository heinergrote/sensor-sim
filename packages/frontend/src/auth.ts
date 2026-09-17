import {createMemo, createSignal} from 'solid-js'
import {honoClient} from "./honoClient";

const [token, setToken] = createSignal<string | null>(
  localStorage.getItem('jwt_token')
)

export function useAuth() {

  const login = (newToken: string) => {
    localStorage.setItem('jwt_token', newToken)
    setToken(newToken)
  }

  const logout = () => {
    localStorage.removeItem('jwt_token')
    setToken(null)
  }

  const user = createMemo(async () => {
    const currentToken = token()
    if (!currentToken) return null

    const res = await honoClient.api.me.$get()

    if (res.ok) {
      const data: { id: number; username: string } = await res.json()
      return data
    } else {
      logout()
      return null
    }

  })

  return {token, login, logout, user}
}