import {createMemo, Loading} from "solid-js";
import {fetchUsers} from "../../service/users.service";
import {Title} from "@solidjs/meta";
import {UserList} from "../../components/users/UserList";
import {UserAddForm} from "../../components/users/UserAddForm";

export default function Users() {

  const users = createMemo(() => fetchUsers());

  return (
    <>
      <Title>Users</Title>
      <UserAddForm/>
      <Loading fallback={<p>Loading users…</p>}>
        <UserList users={users()}></UserList>
      </Loading>
    </>
  );
}
