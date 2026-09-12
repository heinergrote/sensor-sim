import {createSignal, onSettled} from "solid-js";
import {TbFillHome} from "solid-icons/tb";
import {serverUrl, setServerUrl} from "../simulationsService";


export default function Nav() {

  const [inputUrl, setInputUrl] = createSignal("");

  onSettled(() => {
    setInputUrl(serverUrl());
  })

  const handleUrlSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    setServerUrl(inputUrl());
  };

  return (
    <nav class="bg-gray-200">
      <ul class="flex items-center p-2">
        <li class={`mx-1`}>
          <a href="/"><TbFillHome size={24}/></a>
        </li>
        <li class={`mx-1 flex-1`}></li>
        <li class={`mx-1`}>
          <form class='flex gap-2' onSubmit={handleUrlSubmit}>
            <input
              class="w-80 input input-xs"
              type="text"
              value={inputUrl()}
              onInput={(e) => setInputUrl(e.currentTarget.value)}
            />
            <button class={"btn btn-xs"} type="submit">Set</button>
          </form>

        </li>
      </ul>
    </nav>
  );
}
