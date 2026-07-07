import {Router} from "@solidjs/router";
import {FileRoutes} from "@solidjs/start/router";
import {onCleanup, Suspense} from "solid-js";
import Nav from "~/components/Nav";
import "./app.css";
import {isServer} from "solid-js/web";
import {createTrpcHttpOnly, createTrpcWithWs, TrpcContext} from "~/trpcClient";

export default function App() {

  let trpcValue: ReturnType<typeof createTrpcHttpOnly>;
  if (isServer) {
    console.log("Creating trpcHttpOnly");
    trpcValue = createTrpcHttpOnly();
  } else {
    console.log("Creating trpcWithWs");
    const {client, dispose} = createTrpcWithWs();
    onCleanup(dispose);   // ← closes the WS when App unmounts / HMR replaces it
    trpcValue = client;
  }


  return (
    <TrpcContext.Provider value={trpcValue}>
      <Router
        root={props => (
          <>
            <div class="flex flex-col h-screen">
              <Nav/>
              <div class="flex-1 min-h-0">
                <Suspense>{props.children}</Suspense>
              </div>
            </div>
          </>
        )}
      >
        <FileRoutes/>
      </Router>
    </TrpcContext.Provider>
  );
}
