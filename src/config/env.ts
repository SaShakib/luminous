import dotenv from "dotenv";
import Joi from "joi";

dotenv.config({ quiet: process.env.NODE_ENV === "test" });

const schema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().port().default(3000),
  CORS_ORIGIN: Joi.string().allow("").default(""),
  DATABASE_URL: Joi.string().uri({ scheme: [/postgres/] }).optional(),
  PGHOST: Joi.string().optional(),
  PGPORT: Joi.number().port().default(5432),
  PGDATABASE: Joi.string().optional(),
  PGUSER: Joi.string().optional(),
  PGPASSWORD: Joi.string().optional(),
  PG_SSL_CA_PATH: Joi.string().optional(),
  PG_SSL_CA_CERT: Joi.string().optional()
})
  .custom((value, helpers) => {
    if (value.DATABASE_URL) {
      return value;
    }

    const requiredPgFields = ["PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"];
    const missing = requiredPgFields.filter((field) => !value[field]);

    if (missing.length > 0) {
      return helpers.error("any.custom", {
        message: `DATABASE_URL or ${missing.join(", ")} must be provided`
      });
    }

    return value;
  })
  .unknown(true);

const { value, error } = schema.validate(process.env, {
  abortEarly: false,
  convert: true
});

if (error) {
  throw new Error(`Invalid environment: ${error.details.map((detail) => detail.message).join("; ")}`);
}

export const env = {
  nodeEnv: value.NODE_ENV as "development" | "test" | "production",
  port: Number(value.PORT),
  corsOrigin: value.CORS_ORIGIN as string,
  databaseUrl: value.DATABASE_URL as string | undefined,
  pg: {
    host: value.PGHOST as string | undefined,
    port: Number(value.PGPORT),
    database: value.PGDATABASE as string | undefined,
    user: value.PGUSER as string | undefined,
    password: value.PGPASSWORD as string | undefined,
    sslCaPath: value.PG_SSL_CA_PATH as string | undefined,
    sslCaCert: value.PG_SSL_CA_CERT as string | undefined
  }
};
