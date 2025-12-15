export class RateLimiterClient {
	private getLimiterStub: () => DurableObjectStub;
	private reportError: (err: unknown) => void;
	private limiter: DurableObjectStub;
	private inCooldown: boolean;

	constructor(
		getLimiterStub: () => DurableObjectStub,
		reportError: (err: unknown) => void,
	) {
		this.getLimiterStub = getLimiterStub;
		this.reportError = reportError;
		this.limiter = getLimiterStub();
		this.inCooldown = false;
	}

	checkLimit() {
		if (this.inCooldown) {
			return false;
		}
		this.inCooldown = true;
		this.callLimiter();
		return true;
	}

	async callLimiter() {
		try {
			let response: Response;
			try {
				response = await this.limiter.fetch(
					new Request("", { method: "POST" }),
				);
			} catch (_) {
				this.limiter = this.getLimiterStub();
				response = await this.limiter.fetch(
					new Request("", { method: "POST" }),
				);
			}

			const cooldown = +(await response.text());
			await new Promise((resolve) => setTimeout(resolve, cooldown * 1000));
			this.inCooldown = false;
		} catch (err) {
			this.reportError(err);
		}
	}
}
