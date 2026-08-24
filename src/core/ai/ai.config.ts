import { registerAs } from '@nestjs/config';
import { envString } from '../helpers/env.helper.js';

export default registerAs('ai', () => ({
  anthropicApiKey: envString('ANTHROPIC_API_KEY', ''),
  model: envString('AI_MODEL', 'claude-sonnet-5'),
}));
