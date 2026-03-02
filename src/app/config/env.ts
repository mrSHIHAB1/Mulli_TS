import dotenv from "dotenv";

dotenv.config();

interface GOOGLE_TYPE {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_CALLBACK_URL: string;
}

interface APPLE_AUTH_TYPE {
  APPLE_CLIENT_ID: string;
  APPLE_TEAM_ID: string;
  APPLE_KEY_ID: string;
  APPLE_PRIVATE_KEY_PATH: string;
  APPLE_CALLBACK_URL: string;
}

interface TWILIO_TYPE {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

interface EnvConfig {
  PORT: string;
  DB_URL: string;
  NODE_ENV: "development" | "production";

  BCRYPT_SALT_ROUND: string;

  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_EXPIRES: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES: string;

  EXPRESS_SESSION_SECRET: string;

  cloudinary: {
    api_key?: string;
    api_secret?: string;
    cloud_name?: string;
  };

  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  APP_PASS?: string;

  // ✅ Redis
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_USERNAME?: string;
  REDIS_PASSWORD?: string;

  // ✅ SMTP
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_HOST?: string;
  SMTP_HOST_PORT?: string;

  GOOGLE_MAPS_API_KEY:string;
   GOOGLE_AUTH: GOOGLE_TYPE;
  APPLE_AUTH: APPLE_AUTH_TYPE;
  FRONTEND_URL: string;
   twilio: TWILIO_TYPE;
}

const loadEnvVariables = (): EnvConfig => {
  const requiredEnvVariables: string[] = [
    "PORT",
    "DB_URL",
    "NODE_ENV",
    "BCRYPT_SALT_ROUND",
    "JWT_ACCESS_EXPIRES",
    "JWT_ACCESS_SECRET",
    "EXPRESS_SESSION_SECRET",
    "REDIS_HOST",
    "REDIS_PORT",
    "REDIS_USERNAME",
    "REDIS_PASSWORD",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_HOST",
    "SMTP_HOST_PORT",
  
    "GOOGLE_MAPS_API_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL",
      "APPLE_CLIENT_ID",
    "APPLE_TEAM_ID",
    "APPLE_KEY_ID",
    "APPLE_PRIVATE_KEY_PATH",
    "APPLE_CALLBACK_URL",
    "FRONTEND_URL",
        "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
  ];

  requiredEnvVariables.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable ${key}`);
    }
  });

  return {
    PORT: process.env.PORT as string,
    NODE_ENV: process.env.NODE_ENV as "development" | "production",
    DB_URL: process.env.DB_URL as string,

    BCRYPT_SALT_ROUND: process.env.BCRYPT_SALT_ROUND as string,

    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET as string,
    JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES as string,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
    JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES as string,

    EXPRESS_SESSION_SECRET: process.env.EXPRESS_SESSION_SECRET as string,

    cloudinary: {
      api_secret: process.env.CLOUDINARY_API_SECRET,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
    },

    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

    APP_PASS: process.env.APP_PASS,

    // ✅ Redis
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_USERNAME: process.env.REDIS_USERNAME,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,

    // ✅ SMTP
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_HOST_PORT: process.env.SMTP_HOST_PORT,
  
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY as string,
       GOOGLE_AUTH: {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID as string,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET as string,
      GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL as string,
    },
    APPLE_AUTH: {
      APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID as string,
      APPLE_TEAM_ID: process.env.APPLE_TEAM_ID as string,
      APPLE_KEY_ID: process.env.APPLE_KEY_ID as string,
      APPLE_PRIVATE_KEY_PATH: process.env.APPLE_PRIVATE_KEY_PATH as string,
      APPLE_CALLBACK_URL: process.env.APPLE_CALLBACK_URL as string,
    },
    FRONTEND_URL: process.env.FRONTEND_URL as string,
   twilio: {
  accountSid: process.env.TWILIO_ACCOUNT_SID as string,
  authToken: process.env.TWILIO_AUTH_TOKEN as string,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER as string,
},
  };
};

export const envVars = loadEnvVariables();
