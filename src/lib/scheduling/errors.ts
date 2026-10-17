/**
 * An expected failure whose message is safe to show the user, e.g. "This meeting doesn't have a
 * meeting link." Server actions show its message as is; anything else thrown is logged and replaced
 * with a generic message.
 */
export class UserFacingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UserFacingError";
    }
}
