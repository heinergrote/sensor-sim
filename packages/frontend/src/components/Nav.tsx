import {TbOutlineHome, TbOutlineMapPinCog, TbOutlineUsers} from "solid-icons/tb";
import {paths} from "../router";
import {useMatch} from "@solidjs/router";


export default function Nav() {

  const isHome = useMatch(() => paths());
  const isControl = useMatch(() => paths.control());
  const isUsers = useMatch(() => paths.users());

  return (
    <nav class="bg-base-300">
      <ul class="flex items-center p-2 gap-2">
        <a class={`btn ${isHome() ? "btn-primary" : ""}`} href={paths()}>
          <TbOutlineHome size={24}/>
        </a>
        <a class={`btn ${isControl() ? "btn-primary" : ""}`} href={paths.control}>
          <TbOutlineMapPinCog size={24}/> Control
        </a>
        <a class={`btn ${isUsers() ? "btn-primary" : ""}`} href={paths.users}>
          <TbOutlineUsers size={24}/> Users</a>
        <li class={`mx-1 flex-1`}></li>
        <div>{import.meta.env.DEV ? "DEV" : ""}</div>
      </ul>
    </nav>
  );
}
