import {User} from "@sensor-sim/server";
import {createMemo, For} from "solid-js";

type UserWithoutPassword = Omit<User, "password">;

export function UserList(props: { users: UserWithoutPassword[] }) {

  const users = createMemo(() => props.users);

  return (
    <div>
      <ul>
        <For each={users()} keyed={(user) => user.id}>
          {(user, index) =>
            <li>
              <div>{index()}: {user().id}: {user().username}</div>
            </li>
          }
        </For>
      </ul>
    </div>
  );
}