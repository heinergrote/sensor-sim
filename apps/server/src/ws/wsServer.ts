import {WebSocketServer} from "ws";
import {SimConfig, SimState} from "@sensor-sim/shared";
import {simConfigRegistry} from "../index";

export function initWsServer(port: number) {
  const rawWss = new WebSocketServer({port});

  rawWss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', `ws://localhost`);

    if (!url.pathname.startsWith('/ws')) {
      ws.close(1008, 'Not found');
      return;
    }

    const id = url.searchParams.get('id') ?? 'default';
    const simConfig = simConfigRegistry.get(id, true);

    const simState: SimState = {
      id: simConfig.id,
      start: Date.now(),
      current: simConfig.initial,
      distance: 10,
    }

    ws.send(JSON.stringify({simConfig, simState}));

    const listenerFn = (data: { simConfig: SimConfig, simState: SimState }) => {
      ws.send(JSON.stringify(data));
    };
    //sim.addListener(listenerFn);

    ws.on('close', () => {
      //sim.removeListener(listenerFn);
    });
  });

  console.log(`Raw WS Server running on port ${port}`);
  return rawWss;
}
