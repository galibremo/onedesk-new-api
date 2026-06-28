export const sessionTimeout = 1000 * 60 * 60 * 24 * 7; // 1 week in milliseconds
export const sessionRenewalThreshold = sessionTimeout / 2; // refresh when 50% or less remains
export const csrfTimeout = 1000 * 60 * 60; // 1 hour in milliseconds
export const magicLinkTimeout = 1000 * 60 * 15; // 15 minutes in milliseconds
