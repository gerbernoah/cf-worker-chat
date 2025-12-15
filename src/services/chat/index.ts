import type { Service } from "..";

// Export Durable Objects
export { ChatRoom } from "./lib/ChatRoom";
export { Matchmaker } from "./lib/Matchmaker";
export { RateLimiter } from "./lib/RateLimiter";

export const service: Service = {
	path: "/v1/chat/",
	fetch: async (
		request: Request,
		env: Env,
		_ctx: ExecutionContext,
		subPath: string,
	): Promise<Response | undefined> => {
		const [action] = subPath.split("/");

		switch (`${request.method} /${action}`) {
			// WebSocket endpoint - client connects and matchmaker handles everything
			case "GET /connect": {
				if (request.headers.get("Upgrade") !== "websocket") {
					return new Response("Expected WebSocket", { status: 400 });
				}

				const url = new URL(request.url);
				const userId = url.searchParams.get("userId") ?? crypto.randomUUID();
				const userName = url.searchParams.get("userName") ?? "anonymous";

				const matchmaker = env.MATCHMAKER.get(
					env.MATCHMAKER.idFromName("global"),
				);

				// Forward the original request with WebSocket headers to matchmaker
				const internalUrl = new URL(request.url);
				internalUrl.pathname = `/connect`;
				internalUrl.searchParams.set("userId", userId);
				internalUrl.searchParams.set("userName", userName);

				return matchmaker.fetch(
					new Request(internalUrl.toString(), {
						headers: request.headers,
					}),
				);
			}

			// Get matchmaker queue status
			case "GET /status": {
				const matchmaker = env.MATCHMAKER.get(
					env.MATCHMAKER.idFromName("global"),
				);
				return matchmaker.fetch(new Request("http://internal/status"));
			}
		}

		return new Response("Not Found", { status: 404 });
	},
};
