/**
 * An expected failure whose message is safe to show the user, e.g. "This meeting doesn't have a
 * meeting link." Anything else thrown by a service is treated as unexpected and logged.
 */
export class ServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ServiceError";
    }
}
