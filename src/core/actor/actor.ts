export type Actor = { type: 'user'; id: string };
// | { type: 'admin'; id: string; permissions: string[] }
// | { type: 'cli' };

export type UserActor = Extract<Actor, { type: 'user' }>;
