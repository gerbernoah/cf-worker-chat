import { DurableObject } from "cloudflare:workers";

export class Matchmaker extends DurableObject<Env> {
	private waitingQueue: Set<string> = new Set();
	private userSockets: Map<string, WebSocket> = new Map();
	private roomAssociations: Map<string, string> = new Map();
	private matchingScheduled = false;

	// biome-ignore lint/complexity/noUselessConstructor: DO constructor needed
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

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

		if (request.headers.get("Upgrade") === "websocket") {
			const userId = url.searchParams.get("userId") ?? crypto.randomUUID();
			const userName = url.searchParams.get("userName") ?? "anonymous";
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);

			this.ctx.acceptWebSocket(server, [userId, userName]);
			this.userSockets.set(userId, server);
			this.waitingQueue.add(userId);

			server.send(
				JSON.stringify({
					type: "status",
					status: "waiting",
					message: "Looking for a match...",
					userId,
				}),
			);

			// Schedule batch matching if 2+ users waiting
			if (this.waitingQueue.size >= 2 && !this.matchingScheduled) {
				this.matchingScheduled = true;
				await this.ctx.storage.setAlarm(Date.now() + 5000);
			}

			return new Response(null, { status: 101, webSocket: client });
		}

		if (request.method === "GET" && url.pathname === "/status") {
			return Response.json({
				waitingCount: this.waitingQueue.size,
				totalConnected: this.userSockets.size,
			});
		}

		return new Response("Not Found", { status: 404 });
	}

	private async performMatching() {
		this.matchingScheduled = false;

		if (this.waitingQueue.size < 2) return;

		const waiting = Array.from(this.waitingQueue);

		// Shuffle for random matching
		for (let i = waiting.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[waiting[i], waiting[j]] = [waiting[j], waiting[i]];
		}

		// Match pairs
		for (let i = 0; i < waiting.length - 1; i += 2) {
			const user1Id = waiting[i];
			const user2Id = waiting[i + 1];
			const ws1 = this.userSockets.get(user1Id);
			const ws2 = this.userSockets.get(user2Id);

			if (
				!ws1 ||
				!ws2 ||
				ws1.readyState !== WebSocket.OPEN ||
				ws2.readyState !== WebSocket.OPEN
			) {
				// Clean up stale entries
				if (!ws1 || ws1.readyState !== WebSocket.OPEN) {
					this.waitingQueue.delete(user1Id);
					this.userSockets.delete(user1Id);
				}
				if (!ws2 || ws2.readyState !== WebSocket.OPEN) {
					this.waitingQueue.delete(user2Id);
					this.userSockets.delete(user2Id);
				}
				continue;
			}

			const [, user1Name] = this.ctx.getTags(ws1);
			const [, user2Name] = this.ctx.getTags(ws2);
			const roomId = crypto.randomUUID();

			// Create room
			const room = this.env.ROOMS.get(this.env.ROOMS.idFromName(roomId));
			await room.fetch(
				new Request("http://internal/init", {
					method: "POST",
					body: JSON.stringify({
						roomId,
						user1: { userId: user1Id, userName: user1Name },
						user2: { userId: user2Id, userName: user2Name },
					}),
				}),
			);

			// Update in-memory state
			this.roomAssociations.set(user1Id, roomId);
			this.roomAssociations.set(user2Id, roomId);
			this.waitingQueue.delete(user1Id);
			this.waitingQueue.delete(user2Id);

			// Notify users
			ws1.send(
				JSON.stringify({
					type: "room_joined",
					roomId,
					partnerName: user2Name,
					message: `Matched with ${user2Name}!`,
				}),
			);
			ws2.send(
				JSON.stringify({
					type: "room_joined",
					roomId,
					partnerName: user1Name,
					message: `Matched with ${user1Name}!`,
				}),
			);
		}

		// Schedule another round if still 2+ waiting
		if (this.waitingQueue.size >= 2 && !this.matchingScheduled) {
			this.matchingScheduled = true;
			await this.ctx.storage.setAlarm(Date.now() + 5000);
		}
	}

	async alarm() {
		await this.performMatching();
	}

	async webSocketMessage(ws: WebSocket, msg: string) {
		try {
			const [userId, userName] = this.ctx.getTags(ws);
			const data = JSON.parse(msg);
			const roomId = this.roomAssociations.get(userId);

			if (roomId) {
				const room = this.env.ROOMS.get(this.env.ROOMS.idFromName(roomId));

				if (data.type === "roll" || data.type === "leave") {
					await room.fetch(
						new Request(`http://internal/user-left?userId=${userId}`, {
							method: "POST",
						}),
					);

					// Find and notify partner
					let partnerId: string | undefined;
					for (const [uid, rid] of this.roomAssociations) {
						if (rid === roomId && uid !== userId) {
							partnerId = uid;
							break;
						}
					}

					this.roomAssociations.delete(userId);
					this.waitingQueue.add(userId);

					if (partnerId) {
						const partnerWs = this.userSockets.get(partnerId);
						if (partnerWs) {
							partnerWs.send(
								JSON.stringify({
									type: "partner_left",
									message: "Your partner has left the chat",
								}),
							);
						}
						this.roomAssociations.delete(partnerId);
						this.waitingQueue.add(partnerId);
					}

					ws.send(
						JSON.stringify({
							type: "status",
							status: "waiting",
							message: "Looking for a new match...",
						}),
					);

					// Schedule batch matching if 2+ users waiting
					if (this.waitingQueue.size >= 2 && !this.matchingScheduled) {
						this.matchingScheduled = true;
						await this.ctx.storage.setAlarm(Date.now() + 5000);
					}
					return;
				}

				if (data.type === "typing") {
					// Find partner
					for (const [uid, rid] of this.roomAssociations) {
						if (rid === roomId && uid !== userId) {
							const partnerWs = this.userSockets.get(uid);
							if (partnerWs) {
								partnerWs.send(JSON.stringify({ type: "typing", userId }));
							}
							break;
						}
					}
					return;
				}

				if (data.type === "message" && data.content) {
					if (!(await this.checkRateLimit(userId))) {
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

					if (response.ok) {
						const responseData = (await response.json()) as Record<
							string,
							unknown
						>;
						if (responseData.broadcast && responseData.payload) {
							const payload = responseData.payload as Record<string, unknown>;
							// Broadcast to both users in the room
							for (const [uid, rid] of this.roomAssociations) {
								if (rid === roomId) {
									const sock = this.userSockets.get(uid);
									if (sock) {
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
				}
			} else if (data.type === "roll") {
				ws.send(
					JSON.stringify({
						type: "status",
						status: "waiting",
						message: "Already looking for a match...",
					}),
				);
			}
		} catch {
			ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
		}
	}

	async webSocketClose(ws: WebSocket) {
		const [userId] = this.ctx.getTags(ws);
		const roomId = this.roomAssociations.get(userId);

		this.userSockets.delete(userId);
		this.waitingQueue.delete(userId);

		if (roomId) {
			const room = this.env.ROOMS.get(this.env.ROOMS.idFromName(roomId));
			await room.fetch(
				new Request(`http://internal/user-disconnected?userId=${userId}`, {
					method: "POST",
				}),
			);

			// Find and notify partner
			for (const [uid, rid] of this.roomAssociations) {
				if (rid === roomId && uid !== userId) {
					const partnerWs = this.userSockets.get(uid);
					if (partnerWs) {
						partnerWs.send(
							JSON.stringify({
								type: "partner_disconnected",
								message: "Your partner has disconnected",
							}),
						);
					}
					this.roomAssociations.delete(uid);
					this.waitingQueue.add(uid);
					break;
				}
			}

			this.roomAssociations.delete(userId);
		}

		// Schedule batch matching if 2+ users waiting
		if (this.waitingQueue.size >= 2 && !this.matchingScheduled) {
			this.matchingScheduled = true;
			await this.ctx.storage.setAlarm(Date.now() + 5000);
		}
	}

	async webSocketError(ws: WebSocket) {
		await this.webSocketClose(ws);
	}
}
