import 'fastify';
import 'node:http';
import type { Actor } from '../shared/domain/actor/actor.js';

declare module 'http' {
  interface IncomingMessage {
    actor?: Actor;
    ip: string; // set by Fastify (respects trustProxy / X-Forwarded-For)
  }
}
