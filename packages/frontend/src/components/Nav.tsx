import {TbFillHome} from "solid-icons/tb";


export default function Nav() {
  return (
    <nav class="bg-gray-200">
      <ul class="flex items-center p-2">
        <li class={`mx-1`}>
          <a href="/"><TbFillHome size={24}/></a>
        </li>
        <div>{import.meta.env.DEV ? "DEV" : ""}</div>
        <li class={`mx-1 flex-1`}></li>
      </ul>
    </nav>
  );
}
