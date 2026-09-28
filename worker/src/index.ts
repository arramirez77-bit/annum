/** Cloudflare entry point. All logic lives in handler.ts (tested in tests/worker/). */
import { handle, type Env } from './handler';

export default {
  fetch: (request: Request, env: Env): Promise<Response> =>
    handle(request, env, (url, init) => fetch(url, init)),
};
