import {createMemo, createSignal} from 'solid-js'
import {serverUrl} from "./api";
import {Profile} from "@sensor-sim/server";
import ky from "ky";


export const jwtToken = () => localStorage.getItem('jwt_token')

const [token, setToken] = createSignal<string | null>(jwtToken())

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

    const api = ky.create({
      baseUrl: serverUrl,
      headers: {Authorization: `Bearer ${currentToken}`}
    });
    try {
      return await api.get<Profile>("/api/me").json()
    } catch (e) {
      logout()
      return null
    }


  })

  return {login, logout, user}
}