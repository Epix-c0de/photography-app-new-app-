declare global {
  var Deno: {
    env: { get(name: string): string | undefined };
    serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  };
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export const createClient: any;
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Promise<Response> | Response): void;
}

export {};
