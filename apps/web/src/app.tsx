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
    trpcValue = createTrpcHttpOnly();
  } else {
    const {client, dispose} = createTrpcWithWs();
    onCleanup(dispose);   // ← closes the WS when App unmounts / HMR replaces it
    trpcValue = client;
  }


  return (
    <TrpcContext.Provider value={trpcValue}>
      <Router
        root={props => (
          <>
            <Nav/>
            <Suspense>{props.children}</Suspense>
          </>
        )}
      >
        <FileRoutes/>
      </Router>
    </TrpcContext.Provider>
  );
}
