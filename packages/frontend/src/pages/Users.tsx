import {Title} from "@solidjs/meta";
import {createMemo, Loading} from "solid-js";
import {UserList} from "../components/users/UserList";
import {fetchUsers} from "../service/users.service";

export default function Users() {

  const users = createMemo(() => fetchUsers());

  return (
    <>
      <Title>Users</Title>
      <h1>TODO: Users</h1>
      <Loading fallback={<p>Loading users…</p>}>
        <UserList users={users()}></UserList>
      </Loading>
    </>
  );
}
