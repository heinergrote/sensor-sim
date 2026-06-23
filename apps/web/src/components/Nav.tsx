import { useLocation } from "@solidjs/router";

export default function Nav() {
  const location = useLocation();
  const active = (path: string) => path == location.pathname ? "border-sky-600" : "border-transparent hover:border-sky-600";

  return (
    <nav class="bg-gray-800">
      <ul class="container flex items-center p-2 text-gray-200">
        <li class={`border-b-2 ${active("/")} mx-1`}>
          <a href="/">Home</a>
        </li>
      </ul>
    </nav>
  );
}
