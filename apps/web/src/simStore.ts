import {createStore} from "solid-js/store";
import {ClientMsg, ServerMsg, SimState} from "@sensor-sim/shared";

const [simState, setSimState] = createStore<SimState>({
  // default location: Braunschweig, Germany
  latitude: 0,
  longitude: 0,
  altitude: 0,
});

let ws: WebSocket;

export function connectSimStore() {
  ws = new WebSocket('ws://localhost:3001');
  ws.onmessage = (e) => {
    const msg: ServerMsg = JSON.parse(e.data);
    if (msg.type === 'state') {
      setSimState(msg.data);
    }
  };
}

export function disconnectSimStore() {
  ws?.close();
}

export function sendSimUpdate(patch: Partial<SimState>) {
  setSimState(patch as SimState);  // optimistic local update
  ws?.send(JSON.stringify({type: 'setState', data: patch} satisfies ClientMsg));
}

export {simState};
