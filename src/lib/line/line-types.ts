// DealerOS — LINE Integration Types (PHASE46)

// ─── DB types ────────────────────────────────────────────────────────────────

export interface LineCustomerDB {
  id:             string;
  dealer_id:      string;
  customer_id:    string | null;
  line_user_id:   string;
  display_name:   string | null;
  picture_url:    string | null;
  status_message: string | null;
  is_friend:      boolean;
  linked_at:      string | null;
  last_message_at: string | null;
  created_at:     string;
  updated_at:     string;

  // Joined
  customers?: {
    last_name:  string | null;
    first_name: string | null;
    phone:      string | null;
    email:      string | null;
  } | null;
}

export interface DealerSettingsDB {
  id:                  string;
  dealer_id:           string;
  line_channel_id:     string | null;
  line_channel_secret: string | null;  // Server-only
  line_access_token:   string | null;  // Server-only
  line_liff_id:        string | null;
  webhook_url:         string | null;
  line_enabled:        boolean;
  // Business info
  business_name:       string | null;
  business_phone:      string | null;
  business_email:      string | null;
  business_address:    string | null;
  business_website:    string | null;
  logo_url:            string | null;
  // Company info (PHASE66)
  company_name:             string | null;
  postal_code:              string | null;
  contact_name:             string | null;
  qualified_invoice_number: string | null;
  // Document settings (PHASE59)
  stamp_url:           string | null;
  pdf_footer:          string | null;
  invoice_note:        string | null;
  completion_note:     string | null;
  tax_rate:            number;
  terms_and_conditions: string | null;
  // Onboarding (PHASE59)
  onboarding_completed:    boolean;
  onboarding_completed_at: string | null;
  onboarding_step:         number;
  created_at:          string;
  updated_at:          string;
}

// Safe subset for client — never includes secrets
export type DealerSettingsPublic = Omit<DealerSettingsDB,
  'line_channel_secret' | 'line_access_token'>;

// ─── LINE API types ───────────────────────────────────────────────────────────

export interface LineProfile {
  userId:        string;
  displayName:   string;
  pictureUrl?:   string;
  statusMessage?: string;
  language?:     string;
}

// ─── Messaging API types ─────────────────────────────────────────────────────

export type LineMessageType = 'text' | 'image' | 'template' | 'flex';

export interface LineTextMessage {
  type: 'text';
  text: string;
}

export interface LineImageMessage {
  type: 'image';
  originalContentUrl: string;
  previewImageUrl:    string;
}

export type LineMessage = LineTextMessage | LineImageMessage;

export interface LinePushMessageRequest {
  to:       string;  // line_user_id
  messages: LineMessage[];
}

// ─── Webhook event types ──────────────────────────────────────────────────────

export interface LineWebhookSource {
  type:    'user' | 'group' | 'room';
  userId:  string;
  groupId?:  string;
  roomId?:   string;
}

export interface LineFollowEvent {
  type:       'follow';
  replyToken: string;
  source:     LineWebhookSource;
  timestamp:  number;
  mode:       string;
}

export interface LineUnfollowEvent {
  type:      'unfollow';
  source:    LineWebhookSource;
  timestamp: number;
  mode:      string;
}

export interface LineMessageEvent {
  type:       'message';
  replyToken: string;
  source:     LineWebhookSource;
  timestamp:  number;
  mode:       string;
  message: {
    id:   string;
    type: string;
    text?: string;
  };
}

export interface LinePostbackEvent {
  type:       'postback';
  replyToken: string;
  source:     LineWebhookSource;
  timestamp:  number;
  mode:       string;
  postback: {
    data:   string;
    params?: Record<string, string>;
  };
}

export type LineWebhookEvent =
  | LineFollowEvent
  | LineUnfollowEvent
  | LineMessageEvent
  | LinePostbackEvent;

export interface LineWebhookBody {
  destination: string;
  events:      LineWebhookEvent[];
}
