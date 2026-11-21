import {Title} from "@solidjs/meta";
import {createEffect, createMemo} from "solid-js";
import SimList from "../../components/sims/SimList";
import {RouteProps, useNavigate} from "@solidjs/router";
import {Router} from "../../router";
import type {simsRoute} from "./sims.route";
import {configs} from "../../service/configs.service";

export default function Sims(props: RouteProps<typeof simsRoute.path>) {

  const navigate = useNavigate()

  // derived from the list (not a separate query), so the status socket's revalidation keeps it current
  const simConfig = createMemo(() => {
    if (!props.params.id) return undefined
    const id = Number(props.params.id)
    return configs.find(config => config.id === id)
  });

  // the selected sim was deleted (here or by another client) or never existed
  createEffect(() => Boolean(props.params.id) && !simConfig(),
    (missing) => {
      if (missing) navigate(Router.paths.sims(), {replace: true})
    }
  )

  return (
    <>
      <Title>Sensor Sim - Sims</Title>
      <SimList simConfigs={configs} simConfig={simConfig()}/>
    </>
  );
}
