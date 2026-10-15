import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Calculate this week's range (Sunday to Saturday)
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // Find all vacation periods that START during this week
    // (not just overlap — we want to celebrate when their vacation begins)
    const { data: vacations, error: vacError } = await supabase
      .from("vacation_periods")
      .select("*")
      .gte("start_date", weekStartStr)
      .lte("start_date", weekEndStr);

    if (vacError) throw vacError;
    if (!vacations || vacations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notifications_created: 0, message: "No vacations starting this week" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const notificationsToInsert: Array<{
      user_id: string;
      type: string;
      title: string;
      body: string | null;
      link: string | null;
      metadata: Record<string, unknown>;
    }> = [];

    for (const vac of vacations) {
      // Get the vacation owner's profile
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("id, full_name, group_id, account_type")
        .eq("id", vac.user_id)
        .maybeSingle();

      if (!ownerProfile) continue;

      const ownerName = ownerProfile.full_name?.split(" ")[0] ?? "Someone";

      const startDate = new Date(vac.start_date);
      const endDate = new Date(vac.end_date);
      const startStr = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const endStr = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      // Check if we already sent a notification for this vacation this week
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("metadata->>vacation_id", vac.id)
        .eq("type", "vacation_weekly")
        .gte("created_at", weekStartStr);

      if (existing && existing.length > 0) continue;

      // ── GROUP SIDE: Celebratory messages to all group members ──
      if (ownerProfile.group_id) {
        const { data: members } = await supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", ownerProfile.group_id);

        if (members && members.length > 0) {
          const memberIds = members.map((m) => m.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id")
            .in("id", memberIds)
            .eq("notify_group_updates", true);

          if (profiles && profiles.length > 0) {
            for (const profile of profiles) {
              const isOwner = profile.id === vac.user_id;
              notificationsToInsert.push({
                user_id: profile.id,
                type: "vacation_weekly",
                title: `${ownerName} starts vacation this week!`,
                body: isOwner
                  ? `Your vacation runs ${startStr} - ${endStr}. Have a great time and be safe!`
                  : `${ownerName} is on vacation ${startStr} - ${endStr}. The reliever has the route covered. Have a great time and be safe!`,
                link: "/app",
                metadata: {
                  vacation_id: vac.id,
                  vacation_owner: vac.user_id,
                  start_date: vac.start_date,
                  end_date: vac.end_date,
                },
              });
            }
          }
        }
      }

      // ── SOLO SIDE: Warm note to the person on vacation ──
      // If the vacation owner is a solo reliever (account_type = 'solo'),
      // send them a warm note. Also check if any solo gigs are scheduled
      // for them during this vacation period.
      if (ownerProfile.account_type === "solo") {
        notificationsToInsert.push({
          user_id: vac.user_id,
          type: "vacation_weekly",
          title: `Enjoy your vacation!`,
          body: `Your vacation runs ${startStr} - ${endStr}. Have a great time and be safe!`,
          link: "/app",
          metadata: {
            vacation_id: vac.id,
            vacation_owner: vac.user_id,
            start_date: vac.start_date,
            end_date: vac.end_date,
          },
        });
      }

      // ── SOLO SIDE: Also notify the reliever if they have an account ──
      // If this vacation has a reliever_name, try to find a matching user
      // and send them a warm note too.
      if (vac.reliever_name) {
        const { data: relieverProfile } = await supabase
          .from("profiles")
          .select("id, account_type")
          .ilike("full_name", `%${vac.reliever_name}%`)
          .maybeSingle();

        if (relieverProfile && relieverProfile.id !== vac.user_id) {
          notificationsToInsert.push({
            user_id: relieverProfile.id,
            type: "vacation_weekly",
            title: `You're covering for ${ownerName}!`,
            body: `${ownerName} is on vacation ${startStr} - ${endStr}. You're covering the route. Have a great time and be safe!`,
            link: "/app",
            metadata: {
              vacation_id: vac.id,
              vacation_owner: vac.user_id,
              start_date: vac.start_date,
              end_date: vac.end_date,
            },
          });
        }
      }
    }

    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notificationsToInsert);
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_created: notificationsToInsert.length,
        week_start: weekStartStr,
        week_end: weekEndStr,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
