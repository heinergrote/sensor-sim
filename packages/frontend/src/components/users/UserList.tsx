import {User} from "@sensor-sim/shared";
import {createMemo, For} from "solid-js";
import {paths} from "../../router";


export function UserItem(
  props: { user: User }
) {

  return (
    <>

      <li class="list-row">
        <a href={paths.users(props.user.id)}>
          <div class="font-bold">{props.user.id}</div>
        </a>
        <a href={paths.users(props.user.id)}>
          <div>{props.user.username}</div>
        </a>
        <div>{
          props.user.admin ?
            <span class="badge badge-sm badge-secondary">Admin</span>
            :
            <span class="badge badge-sm badge-ghost">User</span>
        }
        </div>
      </li>
    </>

  )

}


export function UserList(props: { users: User[] }) {

  const users = createMemo(() => props.users);

  return (
    <div>
      <ul class="list rounded-box shadow-sm mt-2">
        <For each={users()} keyed={(user) => user.id}>
          {(user) =>
            <UserItem user={user()}/>
          }
        </For>
      </ul>
    </div>
  );
}