/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The public board's address, e.g. https://earthworx-board.<account>.workers.dev. Empty until it's deployed. */
  readonly VITE_BOARD_URL?: string;
}
