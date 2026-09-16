/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly RESEND_API_KEY: string | undefined;
  readonly NOTIFICATION_EMAIL: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
