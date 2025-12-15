import { DurableObject } from "cloudflare:workers";

export class RateLimiter extends DurableObject<Env> {
	private nextAllowedTime: number;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.nextAllowedTime = 0;
	}

	async fetch(request: Request): Promise<Response> {
		const now = Date.now() / 1000;
		this.nextAllowedTime = Math.max(now, this.nextAllowedTime);

		if (request.method === "POST") {
			this.nextAllowedTime += 1; // 1 message per second
		}

		// Allow burst of up to 5 messages (5 second window)
		const cooldown = Math.max(0, this.nextAllowedTime - now - 5);
		return new Response(cooldown.toString());
	}
}
