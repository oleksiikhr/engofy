import { registerAs } from '@nestjs/config';
import { envNumber, envString } from '../helpers/env.helper.js';

export default registerAs('nlp', () => ({
  // Base URL of the FastAPI nlp-service (see nlp-service/README.md).
  baseUrl: envString('NLP_SERVICE_URL', 'http://127.0.0.1:8000'),
  // spaCy parsing of a single text unit is fast, but the service may be
  // cold-starting the model on the first request.
  timeoutMs: envNumber('NLP_SERVICE_TIMEOUT_MS', 30_000),
}));
