import {User} from "@sensor-sim/server";
import {createMemo, For} from "solid-js";
import {paths} from "../../router";

type UserWithoutPassword = Omit<User, "password">;

export function UserItem(
  props: { user: UserWithoutPassword }
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


export function UserList(props: { users: UserWithoutPassword[] }) {

  const users = createMemo(() => props.users);

  return (
    <div>
      <ul class="list rounded-box shadow-sm mt-2">
        <For each={users()} keyed={(user) => user.id}>
          {(user, index) =>
            <UserItem user={user()}/>
          }
        </For>
      </ul>
    </div>
  );
}