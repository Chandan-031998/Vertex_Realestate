import { db } from "../../config/db.js";

function toBool(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}

export async function getAutomationSettings() {
  const pool = db();
  const [[row]] = await pool.query("SELECT * FROM notification_automation_settings WHERE id=1");
  if (row) return row;
  await pool.query("INSERT INTO notification_automation_settings (id) VALUES (1)");
  const [[created]] = await pool.query("SELECT * FROM notification_automation_settings WHERE id=1");
  return created;
}

export async function updateAutomationSettings(patch = {}, updatedBy = null) {
  const pool = db();
  const current = await getAutomationSettings();
  const next = {
    followup_enabled: patch.followup_enabled === undefined ? current.followup_enabled : (toBool(patch.followup_enabled) ? 1 : 0),
    visit_enabled: patch.visit_enabled === undefined ? current.visit_enabled : (toBool(patch.visit_enabled) ? 1 : 0),
    rent_due_enabled: patch.rent_due_enabled === undefined ? current.rent_due_enabled : (toBool(patch.rent_due_enabled) ? 1 : 0),
    agreement_expiry_enabled: patch.agreement_expiry_enabled === undefined ? current.agreement_expiry_enabled : (toBool(patch.agreement_expiry_enabled) ? 1 : 0),
    hold_expiry_enabled: patch.hold_expiry_enabled === undefined ? current.hold_expiry_enabled : (toBool(patch.hold_expiry_enabled) ? 1 : 0),
    internal_enabled: patch.internal_enabled === undefined ? current.internal_enabled : (toBool(patch.internal_enabled) ? 1 : 0),
    email_enabled: patch.email_enabled === undefined ? current.email_enabled : (toBool(patch.email_enabled) ? 1 : 0),
    sms_enabled: patch.sms_enabled === undefined ? current.sms_enabled : (toBool(patch.sms_enabled) ? 1 : 0),
    whatsapp_enabled: patch.whatsapp_enabled === undefined ? current.whatsapp_enabled : (toBool(patch.whatsapp_enabled) ? 1 : 0),
    followup_hours_before: patch.followup_hours_before === undefined ? current.followup_hours_before : Math.max(1, Number(patch.followup_hours_before || 24)),
    visit_hours_before: patch.visit_hours_before === undefined ? current.visit_hours_before : Math.max(1, Number(patch.visit_hours_before || 24)),
    rent_due_days_before: patch.rent_due_days_before === undefined ? current.rent_due_days_before : Math.max(0, Number(patch.rent_due_days_before || 1)),
    agreement_expiry_days_before: patch.agreement_expiry_days_before === undefined ? current.agreement_expiry_days_before : Math.max(1, Number(patch.agreement_expiry_days_before || 30)),
    hold_expiry_hours_before: patch.hold_expiry_hours_before === undefined ? current.hold_expiry_hours_before : Math.max(1, Number(patch.hold_expiry_hours_before || 6)),
  };

  await pool.query(
    `UPDATE notification_automation_settings SET
      followup_enabled=:followup_enabled,
      visit_enabled=:visit_enabled,
      rent_due_enabled=:rent_due_enabled,
      agreement_expiry_enabled=:agreement_expiry_enabled,
      hold_expiry_enabled=:hold_expiry_enabled,
      internal_enabled=:internal_enabled,
      email_enabled=:email_enabled,
      sms_enabled=:sms_enabled,
      whatsapp_enabled=:whatsapp_enabled,
      followup_hours_before=:followup_hours_before,
      visit_hours_before=:visit_hours_before,
      rent_due_days_before=:rent_due_days_before,
      agreement_expiry_days_before=:agreement_expiry_days_before,
      hold_expiry_hours_before=:hold_expiry_hours_before,
      updated_by=:updated_by
     WHERE id=1`,
    { ...next, updated_by: updatedBy }
  );
  return getAutomationSettings();
}

async function queueExternalDispatches(pool, notificationId, settings) {
  const channels = [];
  if (settings.email_enabled) channels.push("Email");
  if (settings.sms_enabled) channels.push("SMS");
  if (settings.whatsapp_enabled) channels.push("WhatsApp");
  for (const channel of channels) {
    await pool.query(
      "INSERT INTO notification_dispatch_logs (notification_id,channel,status,provider_response) VALUES (:notification_id,:channel,'Queued',:provider_response)",
      {
        notification_id: notificationId,
        channel,
        provider_response: `${channel} integration placeholder`,
      }
    );
  }
}

export async function createNotification({
  user_id = null,
  type,
  title = null,
  message,
  event_key = null,
  related_type = null,
  related_id = null,
  meta = null,
} = {}) {
  const pool = db();
  const settings = await getAutomationSettings();
  if (!settings.internal_enabled) return null;

  const [ins] = await pool.query(
    `INSERT INTO notifications
     (user_id,type,title,message,event_key,related_type,related_id,meta,is_read,seen_at)
     VALUES
     (:user_id,:type,:title,:message,:event_key,:related_type,:related_id,:meta,0,NULL)
     ON DUPLICATE KEY UPDATE id=id`,
    {
      user_id,
      type,
      title,
      message,
      event_key,
      related_type,
      related_id,
      meta: meta ? JSON.stringify(meta) : null,
    }
  );

  const notificationId = ins.insertId || 0;
  if (notificationId) {
    await queueExternalDispatches(pool, notificationId, settings);
    return notificationId;
  }
  return null;
}

export async function runReminderJobs() {
  const pool = db();
  const settings = await getAutomationSettings();
  const counts = {
    followup: 0,
    visit: 0,
    rent_due: 0,
    agreement_expiry: 0,
    hold_expiry: 0,
  };
  const todayKey = new Date().toISOString().slice(0, 10);

  if (settings.followup_enabled) {
    const [rows] = await pool.query(
      `SELECT id,lead_id,agent_id,title,due_at,status
       FROM lead_followups
       WHERE status='Pending'
         AND due_at <= DATE_ADD(NOW(), INTERVAL :h HOUR)`,
      { h: Number(settings.followup_hours_before || 24) }
    );
    for (const r of rows) {
      const n = await createNotification({
        user_id: r.agent_id || null,
        type: "FollowupReminder",
        title: "Follow-up reminder",
        message: `${r.title} is due at ${r.due_at}`,
        event_key: `followup:${r.id}:${todayKey}`,
        related_type: "LeadFollowup",
        related_id: r.id,
        meta: { lead_id: r.lead_id, due_at: r.due_at },
      });
      if (n) counts.followup += 1;
    }
  }

  if (settings.visit_enabled) {
    const [rows] = await pool.query(
      `SELECT id,lead_id,property_id,agent_id,scheduled_at,outcome
       FROM site_visits
       WHERE (outcome IS NULL OR outcome='')
         AND scheduled_at <= DATE_ADD(NOW(), INTERVAL :h HOUR)
         AND scheduled_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)`,
      { h: Number(settings.visit_hours_before || 24) }
    );
    for (const r of rows) {
      const n = await createNotification({
        user_id: r.agent_id || null,
        type: "VisitReminder",
        title: "Site visit reminder",
        message: `Visit scheduled at ${r.scheduled_at}`,
        event_key: `visit:${r.id}:${todayKey}`,
        related_type: "SiteVisit",
        related_id: r.id,
        meta: { lead_id: r.lead_id, property_id: r.property_id, scheduled_at: r.scheduled_at },
      });
      if (n) counts.visit += 1;
    }
  }

  if (settings.rent_due_enabled) {
    const [rows] = await pool.query(
      `SELECT rs.id,rs.contract_id,rs.due_date,rs.status,rc.tenant_id
       FROM rent_schedules rs
       JOIN rental_contracts rc ON rc.id = rs.contract_id
       WHERE rs.status IN ('Pending','Overdue')
         AND rs.due_date <= DATE_ADD(CURDATE(), INTERVAL :d DAY)`,
      { d: Number(settings.rent_due_days_before || 1) }
    );
    for (const r of rows) {
      const n = await createNotification({
        user_id: null,
        type: "RentDueReminder",
        title: "Rent due reminder",
        message: `Rent schedule ${r.id} for contract ${r.contract_id} is due on ${r.due_date}`,
        event_key: `rent:${r.id}:${todayKey}`,
        related_type: "RentSchedule",
        related_id: r.id,
        meta: { contract_id: r.contract_id, due_date: r.due_date, tenant_id: r.tenant_id },
      });
      if (n) counts.rent_due += 1;
    }
  }

  if (settings.agreement_expiry_enabled) {
    const [rows] = await pool.query(
      `SELECT id,rental_uid,end_date
       FROM rental_contracts
       WHERE is_active=1
         AND end_date IS NOT NULL
         AND end_date <= DATE_ADD(CURDATE(), INTERVAL :d DAY)`,
      { d: Number(settings.agreement_expiry_days_before || 30) }
    );
    for (const r of rows) {
      const n = await createNotification({
        user_id: null,
        type: "AgreementExpiryReminder",
        title: "Agreement expiry reminder",
        message: `Rental agreement ${r.rental_uid} expires on ${r.end_date}`,
        event_key: `agreement:${r.id}:${todayKey}`,
        related_type: "RentalContract",
        related_id: r.id,
        meta: { end_date: r.end_date },
      });
      if (n) counts.agreement_expiry += 1;
    }
  }

  if (settings.hold_expiry_enabled) {
    const [rows] = await pool.query(
      `SELECT id,booking_uid,hold_expires_at
       FROM bookings
       WHERE status='Hold'
         AND hold_expires_at IS NOT NULL
         AND hold_expires_at <= DATE_ADD(NOW(), INTERVAL :h HOUR)`,
      { h: Number(settings.hold_expiry_hours_before || 6) }
    );
    for (const r of rows) {
      const n = await createNotification({
        user_id: null,
        type: "HoldExpiryReminder",
        title: "Hold expiry reminder",
        message: `Booking hold ${r.booking_uid} expires at ${r.hold_expires_at}`,
        event_key: `hold:${r.id}:${todayKey}`,
        related_type: "Booking",
        related_id: r.id,
        meta: { hold_expires_at: r.hold_expires_at },
      });
      if (n) counts.hold_expiry += 1;
    }
  }

  return counts;
}
