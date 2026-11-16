import {createTileProxy, type TileProvider} from './tileProxy'

export const TILES_PATH = '/api/tiles'

const tileProviders = {
  /** keyless; proxied anyway so tiles stay same-origin and behind login */
  openfreemap: {
    upstream: 'https://tiles.openfreemap.org',
    stylePath: 'styles/bright',
  },
  /** needs `MAPTILER_KEY`, which never leaves the server */
  maptiler: {
    upstream: 'https://api.maptiler.com',
    stylePath: 'maps/streets-v2/style.json',
    keyEnv: 'MAPTILER_KEY',
  },
} satisfies Record<string, TileProvider>

type TileProviderName = keyof typeof tileProviders

function resolveTileProvider(): TileProvider {
  const name = process.env.TILE_PROVIDER || 'openfreemap'
  if (!(name in tileProviders)) {
    throw new Error(`Unknown TILE_PROVIDER "${name}" (expected: ${Object.keys(tileProviders).join(', ')})`)
  }
  const provider = tileProviders[name as TileProviderName]
  // TILE_STYLE overrides the upstream style path, e.g. `styles/positron` or `maps/basic-v2/style.json`
  return {...provider, stylePath: process.env.TILE_STYLE || provider.stylePath}
}

/** `/api/tiles/style.json` + everything it references, from the provider chosen by `TILE_PROVIDER`. */
export const tilesApp = createTileProxy(resolveTileProvider(), TILES_PATH)
