import {WebSocketServer} from 'ws';
import type {ClientMsg, ServerMsg, SimState} from '@sensor-sim/shared';

const simState: SimState = {latitude: 52.264683, longitude: 10.523783, altitude: 70};

type Listener = (s: SimState) => void;
const listeners = new Set<Listener>();

export function updateSimState(patch: Partial<SimState>) {
  console.log("Updating sim state: ", patch);
  Object.assign(simState, patch);
  listeners.forEach(listenerFn => listenerFn({...simState}));
}

const wss = new WebSocketServer({port: 3001});

wss.on('connection', (ws) => {
  // send current state on connect
  const msg: ServerMsg = {type: 'state', data: {...simState}};
  ws.send(JSON.stringify(msg));

  const listenerFn = (data: SimState) => {
    const msg: ServerMsg = {type: 'state', data: {...data}};
    ws.send(JSON.stringify(msg));
  }
  listeners.add(listenerFn);

  // handle incoming commands from this client
  ws.on('message', (raw) => {
    const msg: ClientMsg = JSON.parse(raw.toString());
    if (msg.type === 'setState') updateSimState(msg.data);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    listeners.delete(listenerFn);
  });
});

console.log('WS server running on ws://localhost:3001');