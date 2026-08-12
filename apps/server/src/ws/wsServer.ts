import {WebSocketServer} from "ws";
import {simulationRegistry} from "../index";

export function initWsServer(port: number) {
  const rawWss = new WebSocketServer({port});

  rawWss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '/', `ws://localhost`);

    if (!url.pathname.startsWith('/ws')) {
      ws.close(1008, 'Not found');
      return;
    }

    const id = url.searchParams.get('id') ?? 'default';
    const simulationDataStream = simulationRegistry.getSimulationDataStream(id);

    if (!simulationDataStream) {
      console.log(`Simulation data stream not found for id: ${id}`);
      ws.close(1008, 'Not found');
      return;
    }

    ws.send(JSON.stringify(simulationDataStream?.get()));

    const stream = simulationDataStream.collect();

    ws.on('close', () => {
      console.log(`Closing WS connection for simulation id: ${id}`);
      stream.return(undefined);
    });

    console.log(`WS: Sending data for simulation id: ${id}`);
    for await (const data of stream) {
      ws.send(JSON.stringify(data));
    }
  });

  console.log(`Raw WS Server running on port ${port}`);
  return rawWss;
}
