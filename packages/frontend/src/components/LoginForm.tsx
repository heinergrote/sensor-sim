import {createSignal} from "solid-js";
import {useAuth} from "../auth";
import {api} from "../api";
import {paths} from "../router";
import {useNavigate} from "@solidjs/router";

export default function LoginForm() {
  const [username, setUsername] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [error, setError] = createSignal('')
  const {login, logout, user} = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    setError('')

    try {
      const response = await api.post<{ token: string }>(`/login`, {
        json: {
          username: username(),
          password: password()
        }
      }).json()
      console.log("Login response", response)
      login(response.token)
      navigate(paths.control())

    } catch (e) {
      setError('Login failed')
      logout()
    }

  }

  return (
    <form method="post" onSubmit={handleSubmit} class="flex flex-col w-80 gap-4">
      {error() && <p class="text-red-500">{error()}</p>}
      <input name="username" autocomplete="username" placeholder="Username"
             value={username()}
             onInput={(e) => setUsername(e.currentTarget.value)}
             class="input input-bordered" required/>
      <input name="password" autocomplete="current-password" type="password"
             value={password()}
             onInput={(e) => setPassword(e.currentTarget.value)}
             placeholder="Password" class="input input-bordered" required/>

      <button type="submit" class="btn btn-primary">Login</button>
    </form>
  )
}
