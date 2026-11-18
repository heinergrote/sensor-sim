import './App.css';
import Nav from "./components/Nav";
import {Router} from "./router";
import {Loading} from "solid-js";
import 'maplibre-gl/dist/maplibre-gl.css';

export default function App() {
  return (
    <Router>
      {(props) => (
        <>
          <Loading fallback={<div class="text-center text-2xl opacity-50 font-thin mt-4">Loading... </div>}>
            <div class="flex flex-col h-screen">
              <Nav/>
              <main class="flex-1 min-h-0 p-2">
                {/*<Errored fallback={error => (<p>{String(error())}</p>)}>*/}
                {/*  {props.children}*/}
                {/*</Errored>*/}
                {props.children}
              </main>
            </div>
          </Loading>
        </>
      )}
    </Router>
  );
}


