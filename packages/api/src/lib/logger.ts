import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(process.env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino/file",
          options: { destination: 1 }, // stdout
        },
      }
    : {}),
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "password", "passwordHash", "apiKeyHash"],
    censor: "[REDACTED]",
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});

export type Logger = typeof logger;
