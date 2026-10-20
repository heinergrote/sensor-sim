import {Title} from "@solidjs/meta";
import {createMemo, Loading} from "solid-js";
import {fetchUser} from "../../service/users.service";
import {UserDetail} from "../../components/users/UserDetail";
import {RouteProps} from "@solidjs/router";
import type {userRoute} from "./users.route";

export default function User(props: RouteProps<typeof userRoute.path>) {

  const user = createMemo(() => fetchUser(Number(props.params.id)));

  return (
    <>
      <Title>Sensor Sim - User</Title>
      <Loading fallback={<p>Loading user…</p>}>
        <UserDetail user={user()}/>
      </Loading>
    </>
  );
}
