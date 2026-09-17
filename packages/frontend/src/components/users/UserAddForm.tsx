import {createSignal} from "solid-js";
import {addUser} from "../../service/users.service";
import {TbOutlinePlus, TbOutlineRotateClockwise} from "solid-icons/tb";

export function UserAddForm() {

  const [pending, setPending] = createSignal(false);
  addUser.onSettled(() => setPending(false));

  return (
    <div>

      <form
        action={addUser}
        method="post"
        class="flex gap-1"
        onSubmit={() => setPending(true)}
      >
        <input class="input w-40" type="text" name="username" placeholder="Username"/>
        <input class="input  w-40" type="password" name="password" placeholder="Password"/>
        <label class="label">
          <input type="checkbox" name="admin" class="checkbox"/> Admin
        </label>

        <button
          class="btn btn-primary ms-2"
          disabled={pending()}
          type="submit"
        >
          {pending() ?
            <span class={"animate-spin"}><TbOutlineRotateClockwise size={24}/></span>
            :
            <TbOutlinePlus size={24}/>
          } Add User
        </button>
      </form>

    </div>
  );
}