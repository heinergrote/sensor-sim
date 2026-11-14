import {IControl, Map as MapLibre} from "maplibre-gl";

export class PortalControl implements IControl {
  public container: HTMLElement;
  private _map?: MapLibre;

  constructor(className = 'maplibregl-ctrl maplibregl-ctrl-group') {
    this.container = document.createElement('div');
    this.container.className = className;
  }

  onAdd(map: MapLibre): HTMLElement {
    this._map = map;
    return this.container;
  }

  onRemove(): void {
    this.container.remove();
    this._map = undefined;
  }
}