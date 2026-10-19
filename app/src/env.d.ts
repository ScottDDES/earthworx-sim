/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The public board's address, e.g. https://earthworx-board.<account>.workers.dev. Empty until it's deployed. */
  readonly VITE_BOARD_URL?: string;
  /** 'live' for the store build, which sells the expansion packs; anything else is a beta build, where they're free. */
  readonly VITE_CHANNEL?: string;
}
