import {createSignal} from "solid-js";
import {useAuth} from "../auth";
import {honoClient} from "../honoClient";
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

    const response = await honoClient.api.login.$post({
      json: {
        username: username(),
        password: password()
      }
    })

    if (response.ok) {
      const data = await response.json()
      login(data.token)
      navigate(paths.control())
    } else {
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
