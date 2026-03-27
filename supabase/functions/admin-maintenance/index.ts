import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, requireAdminSecret } from "../_shared/admin.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

type AdminAction =
  | "ping"
  | "get_setting"
  | "upsert_setting";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    requireAdminSecret(req);

    const supabase = createAdminClient();
    const { action, payload } = (await req.json()) as {
      action?: AdminAction;
      payload?: Record<string, unknown>;
    };

    switch (action) {
      case "ping":
        return jsonResponse({
          ok: true,
          message: "Supabase admin connection is ready.",
          timestamp: new Date().toISOString(),
        });

      case "get_setting": {
        const key = String(payload?.key ?? "").trim();
        const branchId = payload?.branch_id ? String(payload.branch_id) : null;

        if (!key) {
          return jsonResponse({ ok: false, error: "Missing payload.key" }, 400);
        }

        const { data, error } = await supabase
          .from("app_settings")
          .select("*")
          .eq("key", key)
          .is("branch_id", branchId)
          .maybeSingle();

        if (error) throw error;

        return jsonResponse({ ok: true, data });
      }

      case "upsert_setting": {
        const key = String(payload?.key ?? "").trim();
        const value = String(payload?.value ?? "").trim();
        const branchId = payload?.branch_id ? String(payload.branch_id) : null;

        if (!key) {
          return jsonResponse({ ok: false, error: "Missing payload.key" }, 400);
        }

        const { data: existing, error: selectError } = await supabase
          .from("app_settings")
          .select("id")
          .eq("key", key)
          .is("branch_id", branchId)
          .maybeSingle();

        if (selectError) throw selectError;

        if (existing?.id) {
          const { error: updateError } = await supabase
            .from("app_settings")
            .update({ value })
            .eq("id", existing.id);

          if (updateError) throw updateError;

          return jsonResponse({
            ok: true,
            mode: "updated",
            key,
            branch_id: branchId,
          });
        }

        const { error: insertError } = await supabase.from("app_settings").insert({
          key,
          value,
          branch_id: branchId,
        });

        if (insertError) throw insertError;

        return jsonResponse({
          ok: true,
          mode: "inserted",
          key,
          branch_id: branchId,
        });
      }

      default:
        return jsonResponse(
          {
            ok: false,
            error:
              "Unsupported action. Use ping, get_setting, or upsert_setting.",
          },
          400,
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
