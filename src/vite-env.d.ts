/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_PUSH_ENABLED?: string;
  readonly VITE_BUILD_NUMBER?: string;
  readonly VITE_GH_REPO?: string;
}
