import nodemailer from "nodemailer";
import { envVars } from "../config/env";

interface SendOtpEmailParams {
  to: string;
  otp: string;
}

export async function sendOtpEmail({ to, otp }: SendOtpEmailParams): Promise<boolean> {
  const transporter = nodemailer.createTransport({
    host: envVars.SMTP_HOST,
    port: Number(envVars.SMTP_HOST_PORT),
    secure: false, // false for TLS port 587
    auth: {
      user: envVars.SMTP_USER,
      pass: envVars.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: envVars.SMTP_USER, // must match your SMTP account
    to,
    subject: "Your OTP Code",
    text: `Your OTP code is: ${otp}`,
  };

  // Send email asynchronously so it doesn't block login
  transporter.sendMail(mailOptions, (err: Error | null, info: nodemailer.SentMessageInfo) => {
    if (err) console.error("OTP email error:", err);
    else console.log("OTP email sent:", info.response);
  });

  // Return immediately
  return true;
}