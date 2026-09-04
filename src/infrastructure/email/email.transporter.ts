import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

export const emailTransporter = nodemailer.createTransport({
  host: env.mail.HOST,
  port: env.mail.PORT,
  secure: env.mail.PORT === 465,
  auth: {
    user: env.mail.USER,
    pass: env.mail.PASS,
  },
});
