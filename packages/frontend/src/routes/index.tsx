import {Title} from "@solidjs/meta";
import {Show} from "solid-js";
import LoginForm from "../components/LoginForm";
import {useAuth} from "../auth";

export default function Home() {

  const {user} = useAuth()

  return (
    <div class="flex flex-col w-full items-center justify-center mt-20">
      <Title>Sensor Sim - Home</Title>

      <h1 class={"text-4xl text-neutral-400 mb-4 "}>Sensor Sim</h1>

      <Show when={user()} fallback={<LoginForm/>}>
        <div>Logged in as {user()?.username}</div>
      </Show>
      {/*<div>{import.meta.env.DEV ? "DEV" : ""}</div>*/}

    </div>
  );
}
