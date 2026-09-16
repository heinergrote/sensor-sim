import {Title} from "@solidjs/meta";
import {createMemo, Loading} from "solid-js";
import {int, RouteProps} from "@solidjs/router";
import {defineFileRoute} from "@solidjs/router/fs";
import {fetchUser} from "../../service/users.service";
import {UserDetail} from "../../components/users/UserDetail";


export const route = defineFileRoute("/users/:id", {
  matchFilters: {id: int},
  preload: ({params}) => void fetchUser(params.id),
});

export default function User(props: RouteProps<typeof route>) {

  const user = createMemo(() => fetchUser(props.params.id));

  return (
    <>
      <Title>User</Title>
      <Loading fallback={<p>Loading user…</p>}>
        <UserDetail user={user()}/>
      </Loading>
    </>
  );
}
