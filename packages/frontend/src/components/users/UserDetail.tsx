import {TbOutlineArrowLeft, TbOutlineDeviceFloppy, TbOutlineTrash} from "solid-icons/tb";
import {useAction, useNavigate} from "@solidjs/router";
import {User} from "@sensor-sim/server";
import {deleteUser, updateUser} from "../../service/users.service";

export function UserDetail(props: {
  user: Omit<User, "password">
}) {

  const navigate = useNavigate()
  const deleteUserAction = useAction(deleteUser)

  deleteUser.onSettled(() => navigate(-1));


  return (
    <>

      <div class={"flex items-center mb-2 gap-2"}>
        <button class="btn" onClick={() => navigate(-1)}>
          <TbOutlineArrowLeft size={24}/> Back
        </button>
        <button type="submit" form="userDetailForm" class="btn btn-primary">
          <TbOutlineDeviceFloppy size={24}/> Save
        </button>
        <button type="button" class="btn btn-error" onClick={() => deleteUserAction(String(props.user.id))}>
          <TbOutlineTrash size={16}/> Delete
        </button>

      </div>

      <form id="userDetailForm" action={updateUser.with(props.user.id)} method="post"
            class={"flex flex-col gap-1"}>
        <input class="input" type="text" name="username" value={props.user.username} placeholder="Username"/>
        <input class="input" type="password" name="password" placeholder="Password"/>
        <label class="label">
          <input type="checkbox" name="admin" checked={props.user.admin} class="checkbox"/> Admin
        </label>
      </form>

    </>
  );

}