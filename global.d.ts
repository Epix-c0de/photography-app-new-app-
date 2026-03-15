declare global {
  const Deno: {
    env: { get(name: string): string | undefined };
    serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  };
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export const createClient: any;
}
export {};
