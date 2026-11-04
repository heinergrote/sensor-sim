import './App.css';
import Nav from "./components/Nav";
import {Router} from "./router";
import {Errored, Loading} from "solid-js";
import 'maplibre-gl/dist/maplibre-gl.css';

export default function App() {
  return (
    <Router>
      {(props) => (
        <>
          <div class="flex flex-col h-screen">
            <Nav/>
            <main class="flex-1 min-h-0 p-2">
              <Loading>
                <Errored fallback={error => (<p>{String(error())}</p>)}>
                  {props.children}
                </Errored>
              </Loading>
            </main>
          </div>
        </>
      )}
    </Router>
  );
}


