/* Minimal structured logger — avoids a heavy dependency while staying greppable. */
type Level = 'info' | 'warn' | 'error' | 'debug';

function emit(level: Level, msg: string, meta?: unknown) {
  const time = new Date().toISOString();
  const base = `[${time}] ${level.toUpperCase()} ${msg}`;
  // eslint-disable-next-line no-console
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta !== undefined) fn(base, meta);
  else fn(base);
}

export const logger = {
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta),
  debug: (msg: string, meta?: unknown) => {
    if (process.env.NODE_ENV !== 'production') emit('debug', msg, meta);
  },
};
