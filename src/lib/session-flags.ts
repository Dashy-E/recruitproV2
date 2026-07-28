// Set right before an intentional sign-out so the session-expiry watcher
// doesn't mistake it for the session silently expiring underneath the user.
export const sessionFlags = { manualSignOut: false };
