import {WebSocket, WebSocketServer} from "ws";
import {simulationService} from "../index";

// Subscribes to an event stream: sends the current snapshot immediately,
// then pushes a new snapshot on each subsequent emission.
async function pipeStream<T>(
  ws: WebSocket,
  stream: AsyncGenerator<T>,
  label: string
) {
  ws.on('close', () => {
    console.log(`WS: closing stream for ${label}`);
    stream.return(undefined);
  });
  for await (const data of stream) {
    if (ws.readyState !== WebSocket.OPEN) break;
    ws.send(JSON.stringify(data));
  }
}

export function initWsServer(port: number) {
  const rawWss = new WebSocketServer({port});

  rawWss.on('connection', async (ws, req) => {

    console.log('WS: new connection', req.url)

    const url = new URL(req.url ?? '/', `ws://localhost`);
    const path = url.pathname;

    // /ws/sims  — simulation list; updated only on configuration changes
    if (path === '/ws/sims') {
      console.log('WS: client subscribed to sim list');
      await pipeStream(ws, simulationService.simListStream.collect(), 'sim list');
      return;
    }

    // /ws/sims/:id  — single simulation detail; updated on every position tick
    const detailMatch = path.match(/^\/ws\/sims\/([^/]+)$/);
    if (detailMatch) {
      const id = detailMatch[1];
      const simStream = simulationService.getSimStream(id);
      if (!simStream) {
        console.log(`WS: sim not found: ${id}`);
        ws.close(1008, 'Not found');
        return;
      }
      console.log(`WS: client subscribed to sim detail: ${id}`);
      await pipeStream(ws, simStream.collect(), `sim ${id}`);
      return;
    }

    ws.close(1008, 'Not found');
  });

  console.log(`Raw WS Server running on port ${port}`);
  return rawWss;
}
