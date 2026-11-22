import {Title} from "@solidjs/meta";
import {createMemo, Loading, Show} from "solid-js";
import LoginForm from "../components/LoginForm";
import {useAuth} from "../auth";
import {TbOutlineMapPinCog} from "solid-icons/tb";
import {fetchOwnSessions, revokeOwnSession} from "../service/sessions.service";
import {SessionList} from "../components/sessions/SessionList";

function OwnSessions() {
  const sessions = createMemo(() => fetchOwnSessions())
  return (
    <div class="mt-4">
      <Loading fallback={<p>Loading sessions…</p>}>
        <SessionList sessions={sessions()} onRevoke={revokeOwnSession}/>
      </Loading>
    </div>
  )
}

export default function Home() {

  const {user} = useAuth()

  return (
    <div class="flex flex-col w-full items-center justify-center mt-20">
      <Title>Sensor Sim - Home</Title>

      <h1 class={"text-4xl text-neutral-400 mb-4 "}>Sensor Sim</h1>

      <Show when={user()} fallback={<LoginForm/>}>
        <div>Logged in as {user()?.username}</div>

        <OwnSessions/>

        <a class="btn mt-4" href="/sims"> <TbOutlineMapPinCog size={24}/> Your Simulations</a>
      </Show>

    </div>

  );
}
