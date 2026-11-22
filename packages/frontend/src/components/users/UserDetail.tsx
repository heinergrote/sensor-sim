import {TbOutlineArrowLeft, TbOutlineDeviceFloppy, TbOutlineTrash} from "solid-icons/tb";
import {useNavigate} from "@solidjs/router";
import {User} from "@sensor-sim/shared";
import {deleteUser, updateUser} from "../../service/users.service";
import {createMemo, Loading, Show} from "solid-js";
import {useAuth} from "../../auth";
import {fetchUserSessions, revokeUserSession} from "../../service/sessions.service";
import {SessionList} from "../sessions/SessionList";

function UserSessions(props: { userId: number }) {
  const sessions = createMemo(() => fetchUserSessions(props.userId))
  return (
    <div class="mt-4">
      <Loading fallback={<p>Loading sessions…</p>}>
        <SessionList sessions={sessions()} onRevoke={(id) => revokeUserSession(props.userId, id)}/>
      </Loading>
    </div>
  )
}

export function UserDetail(props: {
  user: User
}) {

  const navigate = useNavigate()
  const {user: currentUser} = useAuth()

  async function handleSave(e: SubmitEvent & { currentTarget: HTMLFormElement }) {
    e.preventDefault()
    await updateUser(props.user.id, new FormData(e.currentTarget))
  }

  async function handleDelete() {
    await deleteUser(props.user.id)
    navigate(-1)
  }

  return (
    <>

      <div class={"flex items-center mb-2 gap-2"}>
        <button class="btn" onClick={() => navigate(-1)}>
          <TbOutlineArrowLeft size={24}/> Back
        </button>
        <button type="submit" form="userDetailForm" class="btn btn-primary">
          <TbOutlineDeviceFloppy size={24}/> Save
        </button>
        <button type="button" class="btn btn-error" onClick={handleDelete}>
          <TbOutlineTrash size={16}/> Delete
        </button>

      </div>

      <form id="userDetailForm" onSubmit={handleSave} class={"flex flex-col gap-1"}>
        <input class="input" type="text" name="username" value={props.user.username} placeholder="Username"/>
        <input class="input" type="password" name="password" placeholder="Password"/>
        <label class="label">
          <input type="checkbox" name="admin" checked={props.user.admin} class="checkbox"/> Admin
        </label>
      </form>

      <Show when={currentUser()?.admin}>
        <UserSessions userId={props.user.id}/>
      </Show>

    </>
  );

}
