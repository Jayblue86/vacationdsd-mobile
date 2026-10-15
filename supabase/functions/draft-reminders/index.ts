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

    // Fetch all upcoming draft schedules
    const { data: schedules, error: schedError } = await supabase
      .from("draft_schedule")
      .select("*")
      .gte("draft_date", todayStr);

    if (schedError) throw schedError;

    const reminders = [
      { days: 30, field: "reminder_1month_sent", label: "1 month" },
      { days: 7, field: "reminder_1week_sent", label: "1 week" },
      { days: 1, field: "reminder_1day_sent", label: "1 day" },
    ];

    const notificationsToInsert: Array<{
      user_id: string;
      type: string;
      title: string;
      body: string | null;
      link: string | null;
      metadata: Record<string, unknown>;
    }> = [];
    const scheduleUpdates: Array<{ id: string; field: string }> = [];

    for (const sched of schedules ?? []) {
      const draftDate = new Date(sched.draft_date);
      const daysUntil = Math.ceil((draftDate.getTime() - today.getTime()) / 86400000);

      // Get group info
      const { data: group } = await supabase
        .from("groups")
        .select("name")
        .eq("id", sched.group_id)
        .maybeSingle();

      // Get all members of this group who have draft reminders enabled
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", sched.group_id);

      if (!members || members.length === 0) continue;

      // Get profiles with notify_draft_reminders = true
      const memberIds = members.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberIds)
        .eq("notify_draft_reminders", true);

      if (!profiles || profiles.length === 0) continue;

      for (const reminder of reminders) {
        const alreadySent = sched[reminder.field];

        // Check if we're within the reminder window (daysUntil <= reminder.days)
        // and haven't sent this reminder yet
        if (daysUntil <= reminder.days && daysUntil >= 0 && !alreadySent) {
          const groupName = group?.name ?? "Your group";
          const dateStr = draftDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });

          let title: string;
          let body: string;

          if (reminder.days === 1 && daysUntil === 0) {
            title = "Draft starts today!";
            body = `${groupName}'s vacation draft starts today. Get ready to pick your weeks for ${sched.year}.`;
          } else if (reminder.days === 1) {
            title = "Draft starts tomorrow!";
            body = `${groupName}'s vacation draft starts tomorrow, ${dateStr}. Review which weeks you want for ${sched.year}.`;
          } else if (reminder.days === 7) {
            title = "Draft in 1 week";
            body = `${groupName}'s vacation draft starts in 1 week (${dateStr}). Start planning your preferred weeks for ${sched.year}.`;
          } else {
            title = "Draft in 1 month";
            body = `${groupName}'s vacation draft starts in 1 month (${dateStr}). It's time to start thinking about your preferred vacation weeks for ${sched.year}.`;
          }

          for (const profile of profiles) {
            notificationsToInsert.push({
              user_id: profile.id,
              type: "draft_reminder",
              title,
              body,
              link: "/app",
              metadata: {
                group_id: sched.group_id,
                draft_date: sched.draft_date,
                days_until: daysUntil,
                year: sched.year,
              },
            });
          }

          scheduleUpdates.push({ id: sched.id, field: reminder.field });
        }
      }
    }

    // Insert all notifications
    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notificationsToInsert);
      if (insertError) throw insertError;
    }

    // Mark reminders as sent
    for (const update of scheduleUpdates) {
      await supabase
        .from("draft_schedule")
        .update({ [update.field]: true })
        .eq("id", update.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_created: notificationsToInsert.length,
        schedules_updated: scheduleUpdates.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
