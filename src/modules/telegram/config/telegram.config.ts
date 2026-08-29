import { registerAs } from '@nestjs/config';
import { envString } from '../../../core/helpers/env.helper.js';

// Admin bot (PLAN.md §3.9): a single operator drives content ingestion and
// pipeline reruns from a Telegram chat, and published posts are announced to
// one channel. No admin table — the one allowed user id lives here.
export default registerAs('telegram', () => ({
  // Empty in local dev — both crons no-op when it's unset.
  botToken: envString('TELEGRAM_BOT_TOKEN', ''),
  // Numeric Telegram user id whose messages the poll cron acts on. Others are
  // stored (for audit) and ignored.
  adminUserId: envString('TELEGRAM_ADMIN_USER_ID', ''),
  // Channel/chat id the publish cron posts announcements to (e.g. "@engofy"
  // or "-1001234567890").
  channelId: envString('TELEGRAM_CHANNEL_ID', ''),
  apiBaseUrl: envString('TELEGRAM_API_BASE_URL', 'https://api.telegram.org'),
}));
