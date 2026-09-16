import {Title} from "@solidjs/meta";
import SimControl from "../components/control/SimControl";
import {Loading} from "solid-js";

export default function Control() {
  return (
    <>
      <Title>Control</Title>
      <Loading fallback={<>Loading…</>}>
        <SimControl/>
      </Loading>
    </>
  );
}
