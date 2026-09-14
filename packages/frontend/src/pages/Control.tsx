import 'maplibre-gl/dist/maplibre-gl.css';
import SimControl from "../components/control/SimControl";
import {Title} from "@solidjs/meta";

export default function Control() {
  return (
    <>
      <Title>Control</Title>
      <SimControl/>
    </>
  );
}
