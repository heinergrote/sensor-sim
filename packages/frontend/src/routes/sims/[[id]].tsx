import {Title} from "@solidjs/meta";
import {createEffect, createMemo, Loading} from "solid-js";
import SimList from "../../components/sims/SimList";
import {fetchSimConfigs} from "../../service/configs.service";
import {defineFileRoute} from "@solidjs/router/fs";
import {int, RouteProps, useNavigate} from "@solidjs/router";
import {paths} from "../../router";

export const route = defineFileRoute("/sims/:id?", {
  matchFilters: {id: int},
  preload: () => void fetchSimConfigs(),
});


export default function Sim(props: RouteProps<typeof route>) {

  const navigate = useNavigate()

  const simConfigs = createMemo(() => fetchSimConfigs());
  // derived from the list (not a separate query), so the status socket's revalidation keeps it current
  const simConfig = createMemo(() => {
    if (!props.params.id) return undefined
    const id = Number(props.params.id)
    return simConfigs().find(config => config.id === id)
  });

  // the selected sim was deleted (here or by another client) or never existed
  createEffect(() => Boolean(props.params.id) && !simConfig(),
    (missing) => {
      if (missing) navigate(paths.sims(), {replace: true})
    }
  )

  return (
    <>
      <Title>Sims</Title>
      <Loading fallback={<>Loading…</>}>
        <SimList simConfigs={simConfigs()} simConfig={simConfig()}/>
      </Loading>
    </>
  );
}
