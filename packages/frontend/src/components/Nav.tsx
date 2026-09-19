import {TbOutlineHome, TbOutlineLogout, TbOutlineMapPinCog, TbOutlineUser, TbOutlineUsers} from "solid-icons/tb";
import {useMatch, useNavigate} from "@solidjs/router";
import {paths} from "../router";
import {useAuth} from "../auth";
import {createEffect, Loading, Show} from "solid-js";

export default function Nav() {

  const isHome = useMatch(() => paths());
  const isControl = useMatch(() => paths.control());
  const isUsers = useMatch(() => paths.users());

  const {logout, user} = useAuth()
  const navigate = useNavigate()

  createEffect(() => user(),
    (user) => {
      console.log("nav", user)
    }
  )


  return (
    <Loading>
      <nav class="bg-base-300">
        <ul class="flex items-center p-2 gap-2">
          <a class={`btn ${isHome() ? "btn-primary" : ""}`} href={paths()}>
            <TbOutlineHome size={24}/>
          </a>
          <Show when={user()}>
            <a class={`btn ${isControl() ? "btn-primary" : ""}`} href={paths.control}>
              <TbOutlineMapPinCog size={24}/> Control
            </a>
          </Show>
          <Show when={user()?.admin}>
            <a class={`btn ${isUsers() ? "btn-primary" : ""}`} href={paths.users}>
              <TbOutlineUsers size={24}/> Users</a>
          </Show>
          <div class={`mx-1 flex-1`}></div>

          <Show when={user()}>
            {user =>
              <>
                <div class={"flex items-center gap-2"}><TbOutlineUser/> {user()?.username}</div>
                <button class={"btn btn-square btn-sm"} onClick={() => {
                  logout();
                  navigate(paths());
                }}><TbOutlineLogout/></button>
              </>
            }
          </Show>
        </ul>
      </nav>

    </Loading>
  );
}
