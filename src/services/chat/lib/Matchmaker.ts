import { DurableObject } from "cloudflare:workers";

export class Matchmaker extends DurableObject<Env> {
	// biome-ignore lint/complexity/noUselessConstructor: Durable Object constructor
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	// Check rate limit for a user, returns true if allowed
	private async checkRateLimit(userId: string): Promise<boolean> {
		const limiter = this.env.LIMITERS.get(this.env.LIMITERS.idFromName(userId));
		const response = await limiter.fetch(
			new Request("https://internal/", { method: "POST" }),
		);
		const cooldown = Number.parseFloat(await response.text());
		return cooldown <= 0;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const action = url.pathname.slice(1);

		// WebSocket connection
		if (request.headers.get("Upgrade") === "websocket") {
			const userId = url.searchParams.get("userId") ?? crypto.randomUUID();
			const userName = url.searchParams.get("userName") ?? "anonymous";

			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);

			// Tags: [userId, userName, roomId or empty string]
			this.ctx.acceptWebSocket(server, [userId, userName, ""]);

			server.send(
				JSON.stringify({
					type: "status",
					status: "waiting",
					message: "Looking for a match...",
					userId,
				}),
			);

			await this.tryMatch();

			return new Response(null, { status: 101, webSocket: client });
		}

		// Status endpoint
		if (`${request.method} ${action}` === "GET status") {
			const sockets = this.ctx.getWebSockets();
			const sessions = sockets.map((ws) => this.ctx.getTags(ws));
			const waiting = sessions.filter((tags) => !tags[2]);
			return Response.json({
				waitingCount: waiting.length,
				totalConnected: sessions.length,
			});
		}

		return new Response("Not Found", { status: 404 });
	}

	async webSocketMessage(ws: WebSocket, msg: string) {
		try {
			const tags = this.ctx.getTags(ws);
			const [userId, userName] = tags;
			const data = JSON.parse(msg);

			// Check if user is in a room (using storage since tags can't be updated)
			const roomId = await this.ctx.storage.get<string>(`room:${userId}`);

			// If user is in a room, forward message to the room
			if (roomId) {
				const room = this.env.ROOMS.get(this.env.ROOMS.idFromName(roomId));

				// Handle roll/leave commands
				if (data.type === "roll" || data.type === "leave") {
					// Notify room that user is leaving
					await room.fetch(
						new Request(`http://internal/user-left?userId=${userId}`, {
							method: "POST",
						}),
					);

					// Clear room association
					await this.ctx.storage.delete(`room:${userId}`);

					// Notify the other user in the room
					const sockets = this.ctx.getWebSockets();
					for (const sock of sockets) {
						const sockTags = this.ctx.getTags(sock);
						const sockUserId = sockTags[0];
						const sockRoomId = await this.ctx.storage.get<string>(
							`room:${sockUserId}`,
						);
						if (sockRoomId === roomId && sockUserId !== userId) {
							sock.send(
								JSON.stringify({
									type: "partner_left",
									message: "Your partner has left the chat",
								}),
							);
							// Clear their room association too
							await this.ctx.storage.delete(`room:${sockUserId}`);
						}
					}

					// Send waiting status
					ws.send(
						JSON.stringify({
							type: "status",
							status: "waiting",
							message: "Looking for a new match...",
						}),
					);

					// Try to match again
					await this.tryMatch();
					return;
				}

				// Handle typing indicator
				if (data.type === "typing") {
					const sockets = this.ctx.getWebSockets();
					for (const sock of sockets) {
						const sockTags = this.ctx.getTags(sock);
						const sockUserId = sockTags[0];
						const sockRoomId = await this.ctx.storage.get<string>(
							`room:${sockUserId}`,
						);
						if (sockRoomId === roomId && sockUserId !== userId) {
							sock.send(
								JSON.stringify({
									type: "typing",
									userId,
								}),
							);
						}
					}
					return;
				}

				// Forward message to the room
				if (data.type === "message" && data.content) {
					// Check rate limit before sending message
					const allowed = await this.checkRateLimit(userId);
					if (!allowed) {
						ws.send(
							JSON.stringify({
								type: "error",
								message: "You're sending messages too fast. Please slow down.",
							}),
						);
						return;
					}

					const response = await room.fetch(
						new Request("http://internal/message", {
							method: "POST",
							body: JSON.stringify({
								userId,
								userName,
								type: "message",
								message: data.content,
							}),
						}),
					);

					// If room returns a broadcast payload, send to both users in room
					if (response.ok) {
						const responseData = (await response.json()) as Record<
							string,
							unknown
						>;
						if (responseData.broadcast && responseData.payload) {
							const payload = responseData.payload as Record<string, unknown>;
							const sockets = this.ctx.getWebSockets();
							for (const sock of sockets) {
								const sockTags = this.ctx.getTags(sock);
								const sockUserId = sockTags[0];
								const sockRoomId = await this.ctx.storage.get<string>(
									`room:${sockUserId}`,
								);
								if (sockRoomId === roomId) {
									sock.send(
										JSON.stringify({
											type: "message",
											userId,
											userName: payload.name,
											content: payload.message,
											timestamp: payload.timestamp,
										}),
									);
								}
							}
						}
					}
				}
			} else {
				// User is waiting for a match
				if (data.type === "roll") {
					ws.send(
						JSON.stringify({
							type: "status",
							status: "waiting",
							message: "Already looking for a match...",
						}),
					);
				}
			}
		} catch {
			ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
		}
	}

	async webSocketClose(ws: WebSocket) {
		const tags = this.ctx.getTags(ws);
		const [userId] = tags;

		// Check if user was in a room
		const roomId = await this.ctx.storage.get<string>(`room:${userId}`);

		if (roomId) {
			const room = this.env.ROOMS.get(this.env.ROOMS.idFromName(roomId));
			await room.fetch(
				new Request(`http://internal/user-disconnected?userId=${userId}`, {
					method: "POST",
				}),
			);

			// Clear room association
			await this.ctx.storage.delete(`room:${userId}`);

			// Notify the other user in the room
			const sockets = this.ctx.getWebSockets();
			for (const sock of sockets) {
				const sockTags = this.ctx.getTags(sock);
				const sockUserId = sockTags[0];
				const sockRoomId = await this.ctx.storage.get<string>(
					`room:${sockUserId}`,
				);
				if (sockRoomId === roomId && sockUserId !== userId) {
					sock.send(
						JSON.stringify({
							type: "partner_disconnected",
							message: "Your partner has disconnected",
						}),
					);
					// Clear their room association too
					await this.ctx.storage.delete(`room:${sockUserId}`);
				}
			}
		}
	}

	async webSocketError(ws: WebSocket) {
		await this.webSocketClose(ws);
	}

	private async tryMatch() {
		const sockets = this.ctx.getWebSockets();

		// Get all waiting users (no roomId in tags)
		const waiting = sockets.filter((ws) => {
			const tags = this.ctx.getTags(ws);
			return ws.readyState === WebSocket.OPEN && !tags[2];
		});

		if (waiting.length >= 2) {
			const user1Ws = waiting[0];
			const user2Ws = waiting[1];

			const user1Tags = this.ctx.getTags(user1Ws);
			const user2Tags = this.ctx.getTags(user2Ws);

			const roomId = crypto.randomUUID();

			// Create room with both users
			const room = this.env.ROOMS.get(this.env.ROOMS.idFromName(roomId));
			await room.fetch(
				new Request(`http://internal/init`, {
					method: "POST",
					body: JSON.stringify({
						roomId,
						user1: { userId: user1Tags[0], userName: user1Tags[1] },
						user2: { userId: user2Tags[0], userName: user2Tags[1] },
					}),
				}),
			);

			// Update tags with roomId (this associates the WebSocket with the room)
			this.ctx.setWebSocketAutoResponse(
				new WebSocketRequestResponsePair("ping", "pong"),
			);

			// We need to update tags by accepting websocket again with new tags
			// Since we can't update tags directly, we'll store the roomId in storage
			// and check it when messages come in
			await this.ctx.storage.put(`room:${user1Tags[0]}`, roomId);
			await this.ctx.storage.put(`room:${user2Tags[0]}`, roomId);

			// Notify both users they've been matched and joined the room
			try {
				user1Ws.send(
					JSON.stringify({
						type: "room_joined",
						roomId,
						partnerName: user2Tags[1],
						message: `Matched with ${user2Tags[1]}! You can now chat.`,
					}),
				);
				user2Ws.send(
					JSON.stringify({
						type: "room_joined",
						roomId,
						partnerName: user1Tags[1],
						message: `Matched with ${user1Tags[1]}! You can now chat.`,
					}),
				);
			} catch {
				// One might have disconnected
			}
		}
	}
}
