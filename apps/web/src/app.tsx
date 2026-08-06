import {Router} from "@solidjs/router";
import {FileRoutes} from "@solidjs/start/router";
import {createMemo, ParentProps, Show, Suspense} from "solid-js";
import Nav from "~/components/Nav";
import "./app.css";
import {createTrpc, TrpcContext} from "~/trpcClient";

function Root(props: ParentProps) {

  const trpcValue = createMemo(() => createTrpc());

  return (
    <Suspense>
      <Show when={trpcValue()}>
        {(trpc) => (
          <TrpcContext.Provider value={trpc()}>
            <div class="flex flex-col h-screen">
              <Nav/>
              <div class="flex-1 min-h-0">
                <Suspense>{props.children}</Suspense>
              </div>
            </div>
          </TrpcContext.Provider>
        )}
      </Show>
    </Suspense>
  );
}

export default function App() {
  return (
    <Router root={Root}>
      <FileRoutes/>
    </Router>
  );
}