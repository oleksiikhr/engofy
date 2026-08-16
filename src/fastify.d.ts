import 'fastify';
import 'node:http';
import type { Actor } from './core/actor/actor.js';

declare module 'http' {
  interface IncomingMessage {
    actor?: Actor;
    ip: string; // set by Fastify (respects trustProxy / X-Forwarded-For)
  }
}
