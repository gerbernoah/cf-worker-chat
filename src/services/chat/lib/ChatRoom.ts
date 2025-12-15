import { DurableObject } from "cloudflare:workers";

interface UserInfo {
	userId: string;
	userName: string;
}

interface RoomState {
	roomId: string;
	users: Map<string, UserInfo>; // userId -> UserInfo
	lastTimestamp: number;
}

export class ChatRoom extends DurableObject<Env> {
	private state: RoomState;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.state = {
			roomId: "",
			users: new Map(),
			lastTimestamp: 0,
		};
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const action = url.pathname.slice(1);

		switch (`${request.method} ${action}`) {
			case "POST init": {
				// Initialize room with matched users
				const data = await request.json<{
					roomId: string;
					user1: UserInfo;
					user2: UserInfo;
				}>();

				this.state.roomId = data.roomId;
				this.state.users.set(data.user1.userId, data.user1);
				this.state.users.set(data.user2.userId, data.user2);

				return Response.json({ success: true });
			}

			case "POST message": {
				// Handle message from matchmaker
				const data = await request.json<{
					userId: string;
					userName: string;
					type: string;
					message?: string;
				}>();

				if (data.type === "message" && data.message) {
					const message = `${data.message}`;
					if (message.length > 256) {
						return Response.json({ type: "error", error: "Message too long." });
					}

					const timestamp = Math.max(Date.now(), this.state.lastTimestamp + 1);
					this.state.lastTimestamp = timestamp;

					const payload = {
						type: "message",
						name: data.userName,
						message,
						timestamp,
					};

					// Persist message
					const key = new Date(timestamp).toISOString();
					await this.ctx.storage.put(key, JSON.stringify(payload));

					// Return the payload so matchmaker can broadcast it
					return Response.json({
						broadcast: true,
						payload,
					});
				}

				return Response.json({ success: true });
			}

			case "POST user-left": {
				// User intentionally left (roll/leave command)
				const userId = url.searchParams.get("userId");
				if (userId) {
					this.state.users.delete(userId);
				}

				// Room should be destroyed
				await this.ctx.storage.deleteAll();
				return Response.json({
					action: "close_room",
					message: "User left, closing room",
				});
			}

			case "POST user-disconnected": {
				// User disconnected unexpectedly
				const userId = url.searchParams.get("userId");
				if (userId) {
					this.state.users.delete(userId);
				}

				// Room should be destroyed
				await this.ctx.storage.deleteAll();
				return Response.json({
					action: "close_room",
					message: "User disconnected, closing room",
				});
			}

			default:
				return new Response("Not Found", { status: 404 });
		}
	}
}
