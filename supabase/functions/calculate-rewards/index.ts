import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, worker_id, branch_id } = await req.json();

    if (action === "calculate_daily_points") {
      // Get active tasks
      const { data: tasks } = await supabase
        .from("reward_tasks")
        .select("*")
        .eq("is_active", true)
        .eq("frequency", "daily");

      // Get active workers
      let workersQuery = supabase.from("workers").select("id, branch_id").eq("is_active", true).eq("role", "worker");
      if (branch_id) workersQuery = workersQuery.eq("branch_id", branch_id);
      if (worker_id) workersQuery = workersQuery.eq("id", worker_id);
      const { data: workers } = await workersQuery;

      const today = new Date().toISOString().split("T")[0];
      const pointsToInsert: any[] = [];

      for (const worker of workers || []) {
        for (const task of tasks || []) {
          // Check if already processed today
          const { data: existing } = await supabase
            .from("employee_points_log")
            .select("id")
            .eq("worker_id", worker.id)
            .eq("task_id", task.id)
            .eq("point_date", today)
            .maybeSingle();

          if (existing && !task.is_cumulative) continue;

          // Evaluate task based on data_source
          let achieved = false;
          let count = 0;

          const condition = task.condition_logic || {};

          switch (task.data_source) {
            case "visits": {
              const { count: visitCount } = await supabase
                .from("visit_logs")
                .select("*", { count: "exact", head: true })
                .eq("worker_id", worker.id)
                .gte("visited_at", `${today}T00:00:00`)
                .lte("visited_at", `${today}T23:59:59`);
              count = visitCount || 0;
              achieved = count >= (condition.min_count || 1);
              break;
            }
            case "sales": {
              const { data: orders } = await supabase
                .from("orders")
                .select("total_amount")
                .eq("worker_id", worker.id)
                .gte("created_at", `${today}T00:00:00`)
                .lte("created_at", `${today}T23:59:59`)
                .in("status", ["delivered", "completed", "confirmed"]);
              const totalSales = (orders || []).reduce((s, o) => s + Number(o.total_amount || 0), 0);
              count = orders?.length || 0;
              achieved = condition.min_amount ? totalSales >= condition.min_amount : count >= (condition.min_count || 1);
              break;
            }
            case "collections": {
              const { data: payments } = await supabase
                .from("debt_payments")
                .select("amount")
                .eq("worker_id", worker.id)
                .gte("collected_at", `${today}T00:00:00`)
                .lte("collected_at", `${today}T23:59:59`);
              const totalCollected = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
              count = payments?.length || 0;
              achieved = condition.min_amount ? totalCollected >= condition.min_amount : count >= (condition.min_count || 1);
              break;
            }
            case "new_customers": {
              const { count: newCount } = await supabase
                .from("customers")
                .select("*", { count: "exact", head: true })
                .eq("created_by", worker.id)
                .gte("created_at", `${today}T00:00:00`)
                .lte("created_at", `${today}T23:59:59`);
              count = newCount || 0;
              achieved = count >= (condition.min_count || 1);
              break;
            }
            default:
              continue;
          }

          if (achieved) {
            pointsToInsert.push({
              worker_id: worker.id,
              task_id: task.id,
              points: task.reward_points,
              point_type: "reward",
              point_date: today,
              branch_id: worker.branch_id,
              source_entity: task.data_source,
              notes: `تلقائي: ${task.name} (${count})`,
            });
          } else if (task.penalty_points > 0) {
            pointsToInsert.push({
              worker_id: worker.id,
              task_id: task.id,
              points: -task.penalty_points,
              point_type: "penalty",
              point_date: today,
              branch_id: worker.branch_id,
              source_entity: task.data_source,
              notes: `خصم تلقائي: ${task.name}`,
            });
          }
        }
      }

      if (pointsToInsert.length > 0) {
        const { error } = await supabase.from("employee_points_log").insert(pointsToInsert);
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true, processed: pointsToInsert.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "calculate_monthly_bonus") {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const startOfMonth = `${month}-01`;
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      // Get budget settings
      const { data: settingsData } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["reward_monthly_budget", "reward_absolute_cap"]);

      const settingsMap: Record<string, string> = {};
      for (const s of settingsData || []) settingsMap[s.key] = s.value;
      const budget = Number(settingsMap["reward_monthly_budget"] || 0);
      const absoluteCap = Number(settingsMap["reward_absolute_cap"] || 0);

      // Aggregate points per worker
      const { data: pointsData } = await supabase
        .from("employee_points_log")
        .select("worker_id, points, point_type")
        .gte("point_date", startOfMonth)
        .lte("point_date", endOfMonth);

      const workerTotals: Record<string, { rewards: number; penalties: number }> = {};
      for (const p of pointsData || []) {
        if (!workerTotals[p.worker_id]) workerTotals[p.worker_id] = { rewards: 0, penalties: 0 };
        if (p.point_type === "reward") workerTotals[p.worker_id].rewards += Number(p.points);
        else workerTotals[p.worker_id].penalties += Math.abs(Number(p.points));
      }

      const totalPositivePoints = Object.values(workerTotals).reduce(
        (sum, w) => sum + Math.max(0, w.rewards - w.penalties), 0
      );
      const pointValue = totalPositivePoints > 0 ? budget / totalPositivePoints : 0;

      // Get worker salaries
      const workerIds = Object.keys(workerTotals);
      const { data: workersData } = await supabase
        .from("workers")
        .select("id, salary, bonus_cap_percentage")
        .in("id", workerIds);

      const salaryMap: Record<string, { salary: number; cap: number }> = {};
      for (const w of workersData || []) {
        salaryMap[w.id] = { salary: Number(w.salary) || 0, cap: Number(w.bonus_cap_percentage) || 20 };
      }

      // Upsert monthly summary
      for (const [wId, totals] of Object.entries(workerTotals)) {
        const netPoints = totals.rewards - totals.penalties;
        const rawBonus = Math.max(0, netPoints) * pointValue;
        const sInfo = salaryMap[wId] || { salary: 0, cap: 20 };
        const salaryCap = sInfo.salary > 0 ? sInfo.salary * (sInfo.cap / 100) : Infinity;
        const cappedAmount = Math.min(rawBonus, salaryCap, absoluteCap > 0 ? absoluteCap : Infinity);

        // Check existing
        const { data: existing } = await supabase
          .from("monthly_bonus_summary")
          .select("id")
          .eq("worker_id", wId)
          .eq("month", startOfMonth)
          .maybeSingle();

        const record = {
          worker_id: wId,
          month: startOfMonth,
          total_points: netPoints,
          reward_points: totals.rewards,
          penalty_points: totals.penalties,
          point_value: pointValue,
          bonus_amount: rawBonus,
          capped_amount: cappedAmount,
          status: "calculated",
        };

        if (existing) {
          await supabase.from("monthly_bonus_summary").update(record).eq("id", existing.id);
        } else {
          await supabase.from("monthly_bonus_summary").insert(record);
        }
      }

      return new Response(JSON.stringify({ success: true, month, pointValue, workers: workerIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
