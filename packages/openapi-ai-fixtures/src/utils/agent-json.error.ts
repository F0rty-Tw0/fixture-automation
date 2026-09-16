export class AgentJsonError extends Error {
  public override readonly name = 'AgentJsonError';
  public readonly response: string;

  public constructor(message: string, response: string, options?: ErrorOptions) {
    super(message, options);
    this.response = response;
  }
}
