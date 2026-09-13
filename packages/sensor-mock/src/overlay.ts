import type { SensorMockStatus } from "./types.js";

const CONTAINER_STYLE: Partial<CSSStyleDeclaration> = {
  position: "fixed",
  left: "8px",
  bottom: "8px",
  zIndex: "2147483647",
  padding: "6px 8px",
  borderRadius: "6px",
  background: "rgba(20, 20, 20, 0.8)",
  color: "#fff",
  font: "11px/1.4 monospace",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  pointerEvents: "auto",
};

const BUTTON_STYLE: Partial<CSSStyleDeclaration> = {
  cursor: "pointer",
  border: "1px solid #666",
  borderRadius: "4px",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  padding: "2px 6px",
};

function applyStyle(el: HTMLElement, style: Partial<CSSStyleDeclaration>) {
  Object.assign(el.style, style);
}

export type Overlay = {
  update: (status: SensorMockStatus) => void;
  destroy: () => void;
};

/** Minimal, dependency-free bottom-left status/toggle widget. */
export function createOverlay(onToggle: () => void): Overlay {
  const container = document.createElement("div");
  applyStyle(container, CONTAINER_STYLE);
  container.setAttribute("data-sensor-mock-overlay", "");

  const label = document.createElement("span");
  const button = document.createElement("button");
  applyStyle(button, BUTTON_STYLE);
  button.type = "button";
  button.addEventListener("click", onToggle);

  container.append(label, button);
  document.body.appendChild(container);

  return {
    update(status) {
      const conn = status.connection;
      const pos = status.position
        ? `${status.position.latitude.toFixed(5)}, ${status.position.longitude.toFixed(5)}`
        : "no fix";
      label.textContent = `sensor-mock: ${status.enabled ? "on" : "off"} · ${conn} · ${pos}`;
      button.textContent = status.enabled ? "Disable" : "Enable";
    },
    destroy() {
      container.remove();
    },
  };
}
