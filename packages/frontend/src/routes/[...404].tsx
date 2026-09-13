import {Title} from '@solidjs/meta';
import type {RouteDefinition} from '@solidjs/router';
import {httpStatus} from '@solidjs/web';

// The catch-all route. httpStatus() is a no-op in the browser and takes
// effect when SSR is enabled; it runs in preload so the status code is set
// before the response head flushes.
export const route = {
  preload: () => httpStatus(404),
} satisfies RouteDefinition;

export default function NotFound() {
  return (
    <main class="text-center mx-auto text-gray-700 p-4">
      <Title>Not Found</Title>
      <h1>Page Not Found</h1>
    </main>
  )
    ;
}
