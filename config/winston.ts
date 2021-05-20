import appRoot from "app-root-path";
import winston from "winston";

const logger = winston.createLogger({
  format: winston.format.json(),
  exitOnError: false,
  transports: [
    new winston.transports.File({
      filename: `${appRoot}/logs/error.log`,
      level: "error",
    }),
    new winston.transports.File({
      filename: `${appRoot}/logs/combined.log`,
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export const birdsLogger = logger.child({
  service: "birds",
});

export const httpServerLogger = logger.child({
  service: "apps-server",
});
