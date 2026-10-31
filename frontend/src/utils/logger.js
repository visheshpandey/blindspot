// One place for diagnostics. Expected failures (blocked storage, offline backend) are logged at debug level so the
// console stays clean for real errors; anything else goes through `reportError`.
const DEV = import.meta.env.DEV

export const debug = (scope, ...details) => { if (DEV) console.debug(`[blindspot:${scope}]`, ...details) }

export function reportError(scope, error, context) {
  console.error(`[blindspot:${scope}]`, error, context ?? '')
}
