import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getRequiredEnv = (key: string) => {
  const value = Deno.env.get(key);

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const createAdminClient = () => {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const requireAdminSecret = (req: Request) => {
  const expectedSecret = getRequiredEnv("SUPABASE_INTERNAL_ADMIN_SECRET");
  const receivedSecret = req.headers.get("x-admin-secret");

  if (!receivedSecret || receivedSecret !== expectedSecret) {
    throw new Error("Unauthorized admin request");
  }
};
