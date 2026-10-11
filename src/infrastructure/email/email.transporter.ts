
import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

export const emailTransporter = nodemailer.createTransport({
  host: env.mail.HOST,
  port: env.mail.PORT,
  secure: env.mail.PORT === 465,

  // Prevent email requests from hanging indefinitely.
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 30_000,

  auth: {
    user: env.mail.USER,
    pass: env.mail.PASS,
  },
});