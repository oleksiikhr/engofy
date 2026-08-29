/// <reference types="astro/client" />

interface ImportMetaEnv {
  // Origin of the Nest API, used by SSR code in src/lib/api.ts. Defaults to
  // http://localhost:8080 (the repo's dev PORT) when unset.
  readonly API_ORIGIN?: string;
  // Google Identity client id. When unset, the login page hides the Google
  // button and only offers email + OTP.
  readonly PUBLIC_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  // Assigned in Layout.astro from the htmx.org ESM import; used by pages that
  // inject markup at runtime and must (re)process it for hx-* attributes.
  htmx: typeof import('htmx.org').default;
}
