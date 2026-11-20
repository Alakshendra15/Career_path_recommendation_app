/** An error that is safe to show to the client. `code` lets the app branch without matching message text. */
export class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
