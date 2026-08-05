import {WebSocketServer} from "ws";
import {SimState} from "@sensor-sim/shared";
import {simRegistry} from "../index";

export function initWsServer(port: number) {
  const rawWss = new WebSocketServer({port});

  rawWss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', `ws://localhost`);

    if (!url.pathname.startsWith('/ws')) {
      ws.close(1008, 'Not found');
      return;
    }

    const id = url.searchParams.get('id') ?? 'default';
    const sim = simRegistry.get(id, true);

    ws.send(JSON.stringify(sim.simState));

    const listenerFn = (data: SimState) => {
      ws.send(JSON.stringify(data));
    };
    sim.addListener(listenerFn);

    ws.on('close', () => {
      sim.removeListener(listenerFn);
    });
  });

  console.log(`Raw WS Server running on port ${port}`);
  return rawWss;
}
