// import dotenv from 'dotenv'

// dotenv.config()

// function checkRequiredEnvVariables(key: string) {
//    const value = process.env[key]

//    if(!value){
//    throw new Error(`Missing required environment variable: ${key}`)
//    }

//    return value
// }


// export const env = {
//   port: checkRequiredEnvVariables("PORT"),
//   isProduction: checkRequiredEnvVariables("NODE_ENV") === "production",
//   nodeEnv: checkRequiredEnvVariables("NODE_ENV"),
//   logLevel: checkRequiredEnvVariables("LOG_LEVEL"),
// } as const



import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({

  // Application
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().default("/api/v1"),

  
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),


  // Redis 
// REDIS_URL: z.string().min(1, "REDIS_URL is required"),
REDIS_HOST: z.string(),
REDIS_PORT: z.coerce.number(),
REDIS_PASSWORD: z.string().optional(),
REDIS_DB: z.coerce.number().default(0),


//Bccrypt 
BCRYPT_ROUNDS: z.coerce.number().default(12),

 
  // JWT
  // JWT_ACCESS_SECRET: z
  //   .string()
  //   .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),

  // JWT_REFRESH_SECRET: z
  //   .string()
  //   .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  // JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  // JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

 
  // Cookies
  // COOKIE_SECRET: z
  //   .string()
  //   .min(32, "COOKIE_SECRET must be at least 32 characters"),
  // COOKIE_DOMAIN: z.string(),
  // COOKIE_SECURE: z.coerce.boolean().default(false),

 
  // Frontend
  // CLIENT_URL: z.string().url(),


  // Email
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  SMTP_FROM: z.string().min(1, "SMTP_FROM is required"),
  APP_URL: z.string().url(),


  // Logging
  LOG_LEVEL: z.enum([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ]),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  throw new Error(
    `Invalid environment variables:\n${JSON.stringify(
      result.error.flatten().fieldErrors,
      null,
      2
    )}`
  );
}

const config = result.data;

export const env = {
  app: {
    NODE_ENV: config.NODE_ENV,
    PORT: config.PORT,
    API_PREFIX: config.API_PREFIX,
    IS_PRODUCTION: config.NODE_ENV === "production",
  },

  database: {
    URL: config.DATABASE_URL,
  },

  redis: {
    HOST: config.REDIS_HOST,
    PORT: config.REDIS_PORT,
    PASSWORD: config.REDIS_PASSWORD,
    DB: config.REDIS_DB,

  },

  auth: {
  BCRYPT: config.BCRYPT_ROUNDS
},

  // jwt: {
  //   ACCESS_SECRET: config.JWT_ACCESS_SECRET,
  //   REFRESH_SECRET: config.JWT_REFRESH_SECRET,
  //   ACCESS_EXPIRES_IN: config.JWT_ACCESS_EXPIRES_IN,
  //   REFRESH_EXPIRES_IN: config.JWT_REFRESH_EXPIRES_IN,
  // },

  // cookie: {
  //   SECRET: config.COOKIE_SECRET,
  //   DOMAIN: config.COOKIE_DOMAIN,
  //   SECURE: config.COOKIE_SECURE,
  // },

  // client: {
  //   URL: config.CLIENT_URL,
  // },

  mail: {
    HOST: config.SMTP_HOST,
    PORT: config.SMTP_PORT,
    USER: config.SMTP_USER,
    PASS: config.SMTP_PASS,
    FROM: config.SMTP_FROM,
    CLIENT_URL: config.APP_URL,
  },

  logger: {
    LEVEL: config.LOG_LEVEL,
  },
} as const;
