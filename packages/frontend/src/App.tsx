import {Title} from '@solidjs/meta';
import './App.css';
import Nav from "./components/Nav";
import {Router} from "./router";
import {Errored, Loading} from "solid-js";
import 'maplibre-gl/dist/maplibre-gl.css';

// The app root: the router and the site-wide layout live here. Pages are
// the modules under src/routes.
export default function App() {
  return (
    <Router>
      {(props) => (
        <>
          <Title>SensorSim</Title>
          <div class="flex flex-col h-screen">
            <Nav/>
            <main class="flex-1 min-h-0 p-2">
              <Errored
                fallback={error => (
                  <p>{String(error())}</p>
                )}
              >
                <Loading fallback={<>Loading ...</>}>
                  {props.children}
                </Loading>
              </Errored>
            </main>
          </div>
        </>
      )}
    </Router>
  );
}


