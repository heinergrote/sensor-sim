import {Router} from "@solidjs/router";
import {FileRoutes} from "@solidjs/start/router";
import {ParentProps, Suspense} from "solid-js";
import Nav from "~/components/Nav";
import "./app.css";

function Root(props: ParentProps) {


  return (
    <div class="flex flex-col h-screen">
      <Nav/>
      <div class="flex-1 min-h-0">
        <Suspense>{props.children}</Suspense>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router root={Root}>
      <FileRoutes/>
    </Router>
  );
}