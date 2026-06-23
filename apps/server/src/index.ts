import {WebSocketServer} from 'ws';
import type {ClientMsg, ServerMsg, SimState} from '@sensor-sim/shared';

const simState: SimState = {
  target: {latitude: 52.264683, longitude: 10.523783},
  current: {latitude: 52.264683, longitude: 10.523783}
};

type SimListener = (s: SimState) => void;
const listeners = new Set<SimListener>();

export function sendState() {
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
    if (msg.type === 'setTarget') {
      Object.assign(simState.target, msg.data);
      sendState();
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    listeners.delete(listenerFn);
  });
});

console.log('WS server running on ws://localhost:3001');

// add a server loop, that moves the current position towards the target position
setInterval(() => {
  const {target, current} = simState;

  const dLat = target.latitude - current.latitude;
  const dLng = target.longitude - current.longitude;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  const step = 0.00001; // degrees per tick

  if (dist <= step) {
    simState.current = {...target};
  } else {
    simState.current = {
      latitude: current.latitude + (dLat / dist) * step,
      longitude: current.longitude + (dLng / dist) * step,
    };
  }

  sendState();
}, 100);


