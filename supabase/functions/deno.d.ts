// Type declarations for Deno runtime and remote URL imports in Supabase Edge Functions.
// This allows the editor TypeScript language server to resolve types without errors.

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
    options?: { port?: number }
  ): void;
}

declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined;
    export function set(key: string, value: string): void;
  }
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
    options?: { port?: number }
  ): void;
}
