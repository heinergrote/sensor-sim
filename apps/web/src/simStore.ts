import {createStore, reconcile} from "solid-js/store";
import {ClientMsg, Position, ServerMsg, SimState} from "@sensor-sim/shared";

const [simState, setSimState] = createStore<SimState>({
  target: {
    latitude: 0,
    longitude: 0,
  },
  current: {
    latitude: 0,
    longitude: 0,
  },
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

export function setTarget(pos: Position) {
  setSimState("target", reconcile(pos));  // optimistic local update
  ws?.send(JSON.stringify({type: 'setTarget', data: pos} satisfies ClientMsg));
}

export {simState};
