export { service as actuators } from "./actuator";
export { service as chat } from "./chat";

export type Service = {
	path: string;
	fetch: (
		request: Request,
		env: Env,
		ctx: ExecutionContext,
		subPath: string,
	) => Promise<Response | undefined>;
};
