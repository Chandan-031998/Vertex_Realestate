CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(60) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS properties (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  property_uid VARCHAR(40) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL, -- Residential/Commercial/Plot/Villa/Apartment
  status VARCHAR(50) NOT NULL DEFAULT 'Available',
  description TEXT NULL,

  city VARCHAR(80) NULL,
  area VARCHAR(120) NULL,
  pincode VARCHAR(12) NULL,
  landmark VARCHAR(120) NULL,
  map_link TEXT NULL,

  base_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  negotiable TINYINT(1) NOT NULL DEFAULT 0,
  taxes DECIMAL(12,2) NOT NULL DEFAULT 0,
  brokerage DECIMAL(12,2) NOT NULL DEFAULT 0,
  maintenance_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  stamp_duty_estimate DECIMAL(12,2) NOT NULL DEFAULT 0,

  video_link TEXT NULL,
  brochure_path TEXT NULL,
  qr_path TEXT NULL,

  created_by BIGINT NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  seo_title VARCHAR(200) NULL,
  seo_description VARCHAR(255) NULL,
  seo_keywords VARCHAR(255) NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS property_images (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  property_id BIGINT NOT NULL,
  image_path TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS amenities (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS property_amenities (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  property_id BIGINT NOT NULL,
  amenity_id BIGINT NOT NULL,
  UNIQUE KEY uniq_prop_amen (property_id, amenity_id),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (amenity_id) REFERENCES amenities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS property_documents (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  property_id BIGINT NOT NULL,
  doc_type VARCHAR(80) NOT NULL, -- Khata/RTC/EC/OC/NOC/PlanApproval etc
  version_no INT NOT NULL DEFAULT 1,
  original_name VARCHAR(255) NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

-- Inventory: tower -> floor -> unit
CREATE TABLE IF NOT EXISTS towers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  property_id BIGINT NOT NULL,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS floors (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tower_id BIGINT NOT NULL,
  floor_no INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tower_id) REFERENCES towers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS units (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  floor_id BIGINT NOT NULL,
  unit_no VARCHAR(30) NOT NULL,
  bhk VARCHAR(20) NULL,
  area_sqft DECIMAL(10,2) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Available',
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE
);

-- Leads CRM
CREATE TABLE IF NOT EXISTS leads (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  lead_uid VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(190) NULL,
  source VARCHAR(60) NULL, -- website/walkin/phone/whatsapp/referral
  campaign VARCHAR(80) NULL, -- google/meta/justdial etc
  budget DECIMAL(12,2) NULL,
  area_pref VARCHAR(120) NULL,
  type_pref VARCHAR(50) NULL,
  bhk_pref VARCHAR(20) NULL,
  urgency VARCHAR(30) NULL, -- low/medium/high
  stage VARCHAR(60) NOT NULL DEFAULT 'New',
  score INT NOT NULL DEFAULT 0,
  assigned_to BIGINT NULL,
  property_interest_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_notes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  lead_id BIGINT NOT NULL,
  note TEXT NOT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lead_followups (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  lead_id BIGINT NOT NULL,
  agent_id BIGINT NULL,
  title VARCHAR(255) NOT NULL,
  due_at DATETIME NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lead_calls (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  lead_id BIGINT NOT NULL,
  call_time DATETIME NOT NULL,
  outcome VARCHAR(120) NULL,
  remarks TEXT NULL,
  attachment_path TEXT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  customer_uid VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(190) NULL,
  address TEXT NULL,
  pan VARCHAR(20) NULL,
  aadhaar VARCHAR(20) NULL,
  gst VARCHAR(30) NULL,
  pref_area VARCHAR(120) NULL,
  pref_type VARCHAR(50) NULL,
  pref_budget_min DECIMAL(12,2) NULL,
  pref_budget_max DECIMAL(12,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_kyc_documents (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  doc_type VARCHAR(30) NOT NULL, -- PAN/Aadhaar/GST
  file_path TEXT NOT NULL,
  original_name VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customer_family_members (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  relation VARCHAR(60) NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(190) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_uid VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(190) NULL,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  verification_doc_path TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_verification_notes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  status VARCHAR(30) NOT NULL,
  note TEXT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS owners (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_uid VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(190) NULL,
  address TEXT NULL,
  owner_type VARCHAR(30) NOT NULL DEFAULT 'Rental', -- Rental/Managed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS owner_properties (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_id BIGINT NOT NULL,
  property_id BIGINT NOT NULL,
  management_type VARCHAR(30) NOT NULL DEFAULT 'Rental', -- Rental/Managed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_owner_property (owner_id, property_id),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_visits (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  visit_uid VARCHAR(40) NOT NULL UNIQUE,
  lead_id BIGINT NULL,
  property_id BIGINT NULL,
  scheduled_at DATETIME NOT NULL,
  agent_id BIGINT NULL,
  route_link TEXT NULL,
  outcome VARCHAR(120) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  booking_uid VARCHAR(40) NOT NULL UNIQUE,
  property_id BIGINT NOT NULL,
  unit_id BIGINT NULL,
  customer_id BIGINT NULL,
  token_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'Hold', -- Hold/Booked/Cancelled/Expired
  hold_expires_at DATETIME NULL,
  cancellation_status VARCHAR(30) NOT NULL DEFAULT 'None', -- None/Requested/Approved/Rejected
  cancellation_reason TEXT NULL,
  cancellation_requested_by BIGINT NULL,
  cancellation_requested_at DATETIME NULL,
  cancellation_approved_by BIGINT NULL,
  cancellation_approved_at DATETIME NULL,
  refund_status VARCHAR(30) NOT NULL DEFAULT 'None', -- None/Requested/Approved/Rejected
  refund_amount DECIMAL(12,2) NULL,
  refund_reason TEXT NULL,
  refund_requested_by BIGINT NULL,
  refund_requested_at DATETIME NULL,
  refund_approved_by BIGINT NULL,
  refund_approved_at DATETIME NULL,
  confirmation_pdf_path TEXT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  invoice_no VARCHAR(40) NOT NULL UNIQUE,
  type VARCHAR(40) NOT NULL, -- Token/Rent/Brokerage/Maintenance
  customer_id BIGINT NULL,
  property_id BIGINT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0, -- base amount before GST
  gst_enabled TINYINT(1) NOT NULL DEFAULT 0,
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  taxable_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  invoice_kind VARCHAR(30) NOT NULL DEFAULT 'Invoice', -- Invoice/TokenReceipt/BookingReceipt
  amount_due DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Unpaid',
  invoice_date DATE NOT NULL,
  pdf_path TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  invoice_id BIGINT NOT NULL,
  payment_no VARCHAR(50) NULL,
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(30) NULL, -- cash/upi/bank/cheque/card/netbanking
  ref_no VARCHAR(80) NULL,
  cheque_no VARCHAR(80) NULL,
  cheque_status VARCHAR(30) NULL, -- Pending/Cleared/Bounced
  note TEXT NULL,
  paid_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS billing_notes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  note_no VARCHAR(50) NOT NULL UNIQUE,
  note_type VARCHAR(20) NOT NULL, -- Credit/Refund
  invoice_id BIGINT NULL,
  customer_id BIGINT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  reason TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Issued', -- Issued/Applied/Cancelled
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(160) NULL,
  message TEXT NOT NULL,
  event_key VARCHAR(150) NULL,
  related_type VARCHAR(60) NULL,
  related_id BIGINT NULL,
  meta JSON NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  seen_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_notification_event (event_key)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  meta JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agreement_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  txn_type VARCHAR(30) NOT NULL, -- Sale/Rent/Lease/PM
  template_body TEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agreement_transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  agreement_uid VARCHAR(40) NOT NULL UNIQUE,
  txn_type VARCHAR(30) NOT NULL, -- Sale/Rent/Lease/PM
  template_id BIGINT NULL,
  property_id BIGINT NULL,
  customer_id BIGINT NULL,
  owner_id BIGINT NULL,
  expiry_date DATE NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Draft', -- Draft/Under Review/Approved/Registered
  title_verification_status VARCHAR(30) NOT NULL DEFAULT 'Pending', -- Pending/Verified/Issue Found/Cleared
  legal_approval_status VARCHAR(30) NOT NULL DEFAULT 'Pending', -- Pending/Verified/Issue Found/Cleared
  legal_notes TEXT NULL,
  legal_report_path TEXT NULL,
  ready_for_registration_status VARCHAR(30) NOT NULL DEFAULT 'Pending', -- Pending/Approved
  ready_for_registration_by BIGINT NULL,
  ready_for_registration_at DATETIME NULL,
  final_doc_status VARCHAR(30) NOT NULL DEFAULT 'Pending', -- Pending/Approved
  final_doc_approved_by BIGINT NULL,
  final_doc_approved_at DATETIME NULL,
  e_sign_provider VARCHAR(50) NULL,
  e_sign_status VARCHAR(30) NOT NULL DEFAULT 'Not Initiated',
  e_sign_reference VARCHAR(120) NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES agreement_templates(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS agreement_checklist_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  transaction_id BIGINT NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  is_required TINYINT(1) NOT NULL DEFAULT 1,
  is_submitted TINYINT(1) NOT NULL DEFAULT 0,
  remarks TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES agreement_transactions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS registration_appointments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  transaction_id BIGINT NOT NULL,
  appointment_at DATETIME NOT NULL,
  office_name VARCHAR(160) NULL,
  slot_no VARCHAR(60) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending', -- Pending/Scheduled/Completed
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES agreement_transactions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rental_contracts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  rental_uid VARCHAR(40) NOT NULL UNIQUE,
  property_id BIGINT NOT NULL,
  unit_id BIGINT NULL,
  owner_id BIGINT NULL,
  tenant_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  rent_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  cycle VARCHAR(20) NOT NULL DEFAULT 'Monthly', -- Monthly/Quarterly
  due_day INT NOT NULL DEFAULT 5,
  late_fee_type VARCHAR(20) NOT NULL DEFAULT 'Flat', -- Flat/Percent
  late_fee_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rent_schedules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  contract_id BIGINT NOT NULL,
  due_date DATE NOT NULL,
  period_label VARCHAR(30) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  late_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending/Paid/Overdue
  paid_at DATETIME NULL,
  receipt_no VARCHAR(60) NULL,
  payment_mode VARCHAR(30) NULL,
  payment_ref VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES rental_contracts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  ticket_uid VARCHAR(40) NOT NULL UNIQUE,
  property_id BIGINT NOT NULL,
  unit_id BIGINT NULL,
  tenant_id BIGINT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium', -- Low/Medium/High/Urgent
  status VARCHAR(30) NOT NULL DEFAULT 'Open', -- Open/In Progress/Resolved/Closed
  vendor_name VARCHAR(120) NULL,
  vendor_phone VARCHAR(30) NULL,
  assigned_at DATETIME NULL,
  sla_due_at DATETIME NULL,
  resolved_at DATETIME NULL,
  cost_estimate DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_actual DECIMAL(12,2) NOT NULL DEFAULT 0,
  vendor_payment_request_status VARCHAR(20) NOT NULL DEFAULT 'None', -- None/Requested/Approved/Paid/Rejected
  vendor_payment_requested_amount DECIMAL(12,2) NULL,
  vendor_payment_requested_at DATETIME NULL,
  vendor_payment_requested_by BIGINT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS property_inspections (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  inspection_uid VARCHAR(40) NOT NULL UNIQUE,
  property_id BIGINT NOT NULL,
  unit_id BIGINT NULL,
  inspector_id BIGINT NULL,
  inspection_date DATE NOT NULL,
  summary TEXT NULL,
  report_path TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_move_checklists (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  checklist_uid VARCHAR(40) NOT NULL UNIQUE,
  tenant_id BIGINT NOT NULL,
  property_id BIGINT NULL,
  unit_id BIGINT NULL,
  checklist_type VARCHAR(20) NOT NULL DEFAULT 'Move-In', -- Move-In/Move-Out
  target_date DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending/In Progress/Completed
  checklist_json JSON NULL,
  notes TEXT NULL,
  completed_at DATETIME NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenant_complaints (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  complaint_uid VARCHAR(40) NOT NULL UNIQUE,
  tenant_id BIGINT NOT NULL,
  property_id BIGINT NULL,
  unit_id BIGINT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'General',
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium', -- Low/Medium/High/Urgent
  status VARCHAR(30) NOT NULL DEFAULT 'Open', -- Open/In Progress/Resolved/Closed
  assigned_to BIGINT NULL,
  escalation_level VARCHAR(20) NOT NULL DEFAULT 'None', -- None/L1/L2/L3
  resolution_notes TEXT NULL,
  resolved_at DATETIME NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  account_code VARCHAR(20) NOT NULL UNIQUE,
  account_name VARCHAR(120) NOT NULL,
  account_type VARCHAR(30) NOT NULL, -- Asset/Liability/Income/Expense/Equity
  parent_code VARCHAR(20) NULL,
  vertex_account_code VARCHAR(40) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  journal_no VARCHAR(50) NOT NULL UNIQUE,
  txn_date DATETIME NOT NULL,
  source_type VARCHAR(40) NOT NULL, -- Billing/Rentals/Bookings/Manual
  source_id BIGINT NULL,
  narration TEXT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  journal_entry_id BIGINT NOT NULL,
  account_code VARCHAR(20) NOT NULL,
  dr_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  cr_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_note VARCHAR(200) NULL,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_commission_rules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  agent_id BIGINT NOT NULL,
  rule_type VARCHAR(20) NOT NULL DEFAULT 'Percent', -- Percent/Fixed
  percentage_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  fixed_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_comm_rule_agent_active (agent_id, is_active)
);

CREATE TABLE IF NOT EXISTS commission_payouts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  payout_no VARCHAR(50) NOT NULL UNIQUE,
  agent_id BIGINT NOT NULL,
  period_from DATE NULL,
  period_to DATE NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending/Approved/Paid/Rejected
  approved_by BIGINT NULL,
  approved_at DATETIME NULL,
  paid_at DATETIME NULL,
  payment_mode VARCHAR(30) NULL,
  payment_ref VARCHAR(100) NULL,
  note TEXT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_comm_payout_agent_status (agent_id, status)
);

CREATE TABLE IF NOT EXISTS booking_commission_splits (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  booking_id BIGINT NOT NULL,
  agent_id BIGINT NOT NULL,
  share_type VARCHAR(20) NOT NULL DEFAULT 'Percent', -- Percent/Fixed
  share_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending/Approved/Paid/Rejected
  payout_id BIGINT NULL,
  approved_by BIGINT NULL,
  approved_at DATETIME NULL,
  paid_at DATETIME NULL,
  note TEXT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (payout_id) REFERENCES commission_payouts(id) ON DELETE SET NULL,
  INDEX idx_comm_split_booking (booking_id),
  INDEX idx_comm_split_agent_status (agent_id, status)
);

CREATE TABLE IF NOT EXISTS marketing_campaign_spend (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  month_label VARCHAR(7) NOT NULL, -- YYYY-MM
  source VARCHAR(60) NOT NULL,
  campaign VARCHAR(80) NULL,
  spend_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_campaign_month (month_label, source, campaign)
);

CREATE TABLE IF NOT EXISTS notification_automation_settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  followup_enabled TINYINT(1) NOT NULL DEFAULT 1,
  visit_enabled TINYINT(1) NOT NULL DEFAULT 1,
  rent_due_enabled TINYINT(1) NOT NULL DEFAULT 1,
  agreement_expiry_enabled TINYINT(1) NOT NULL DEFAULT 1,
  hold_expiry_enabled TINYINT(1) NOT NULL DEFAULT 1,
  internal_enabled TINYINT(1) NOT NULL DEFAULT 1,
  email_enabled TINYINT(1) NOT NULL DEFAULT 0,
  sms_enabled TINYINT(1) NOT NULL DEFAULT 0,
  whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0,
  followup_hours_before INT NOT NULL DEFAULT 24,
  visit_hours_before INT NOT NULL DEFAULT 24,
  rent_due_days_before INT NOT NULL DEFAULT 1,
  agreement_expiry_days_before INT NOT NULL DEFAULT 30,
  hold_expiry_hours_before INT NOT NULL DEFAULT 6,
  updated_by BIGINT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_dispatch_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  notification_id BIGINT NOT NULL,
  channel VARCHAR(20) NOT NULL, -- SMS/Email/WhatsApp
  status VARCHAR(20) NOT NULL DEFAULT 'Queued', -- Queued/Sent/Failed
  provider_response TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  app_name VARCHAR(120) NULL,
  company_name VARCHAR(150) NULL,
  company_legal_name VARCHAR(190) NULL,
  company_email VARCHAR(190) NULL,
  company_phone VARCHAR(40) NULL,
  company_website VARCHAR(190) NULL,
  company_address TEXT NULL,
  company_gst VARCHAR(60) NULL,
  logo_path TEXT NULL,
  theme_mode VARCHAR(20) NOT NULL DEFAULT 'light',
  ui_style VARCHAR(20) NOT NULL DEFAULT 'comfortable',
  sidebar_style VARCHAR(20) NOT NULL DEFAULT 'default',
  primary_color VARCHAR(20) NOT NULL DEFAULT '#0f172a',
  accent_color VARCHAR(20) NOT NULL DEFAULT '#334155',
  updated_by BIGINT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
