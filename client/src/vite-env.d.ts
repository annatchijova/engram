/// <reference types="vite/client" />
/// <reference types="@iwsdk/vite-plugin-dev/client" />

interface ImportMetaEnv {
  readonly VITE_ENGRAM_API_BASE?: string;
  readonly VITE_ENGRAM_READ_TOKEN?: string;
  readonly VITE_IWSDK_EXAMPLE_ASSET_BASE_URL?: string;
}
