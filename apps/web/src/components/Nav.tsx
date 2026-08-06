import {useLocation} from "@solidjs/router";
import {trpcService} from "~/trcpService";
import {createSignal, onMount} from "solid-js";


export default function Nav() {
  const location = useLocation();
  const active = (path: string) => path == location.pathname ? "border-sky-600" : "border-transparent hover:border-sky-600";

  const [inputUrl, setInputUrl] = createSignal(trpcService.url());

  const handleUrlSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    trpcService.setUrl(inputUrl());
  };

  onMount(() => {
    trpcService.initUrl();
    setInputUrl(trpcService.url());
  })

  return (
    <nav class="bg-gray-200">
      <ul class="flex items-center p-2">
        <li class={`border-b-2 ${active("/")} mx-1`}>
          <a href="/">Home</a>
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
