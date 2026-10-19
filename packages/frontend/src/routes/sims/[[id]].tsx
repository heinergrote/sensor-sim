import {Title} from "@solidjs/meta";
import {createMemo, Loading} from "solid-js";
import SimList from "../../components/sims/SimList";
import {fetchSimConfig, fetchSimConfigs} from "../../service/configs.service";
import {defineFileRoute} from "@solidjs/router/fs";
import {int, RouteProps} from "@solidjs/router";

export const route = defineFileRoute("/sims/:id?", {
  matchFilters: {id: int},
  preload: ({params}) => {
    void fetchSimConfigs()
    if (params.id) void fetchSimConfig(Number(params.id))
  },
});


export default function Sim(props: RouteProps<typeof route>) {

  const simConfigs = createMemo(() => fetchSimConfigs());
  const simConfig = createMemo(() => props.params.id ? fetchSimConfig(Number(props.params.id)) : undefined);

  return (
    <>
      <Title>Sims</Title>
      <Loading fallback={<>Loading…</>}>
        <SimList simConfigs={simConfigs()} simConfig={simConfig()}/>
      </Loading>
    </>
  );
}
