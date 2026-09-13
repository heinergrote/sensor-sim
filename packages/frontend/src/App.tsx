import {Title} from '@solidjs/meta';
import {Loading} from 'solid-js';
import {Router} from './router';
import './App.css';
import Nav from "./components/Nav";

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
            <div class="flex-1 min-h-0">
              <Loading fallback={<main>Loading…</main>}>
                {props.children}
              </Loading>
            </div>
          </div>
        </>
      )}
    </Router>
  );
}


