import twilio, { Twilio } from "twilio";
import { envVars } from "./env.js";

// Define return type for SMS response
interface ISendSMSResponse {
  success: boolean;
  messageSid?: string;
  error?: string;
}

// Validate required environment variables
if (
  !envVars.twilio.accountSid ||
  !envVars.twilio.authToken ||
  !envVars.twilio.phoneNumber
) {
  throw new Error("Twilio credentials are not configured properly");
}

// Create Twilio client with proper type
export const twilioClient: Twilio = twilio(
  envVars.twilio.accountSid,
  envVars.twilio.authToken
);

// Send SMS function
export const sendSMS = async (
  to: string,
  message: string
): Promise<ISendSMSResponse> => {
  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: envVars.twilio.phoneNumber,
      to,
    });

    console.log("SMS sent successfully:", result.sid);

    return {
      success: true,
      messageSid: result.sid,
    };
  } catch (error: any) {
    console.error("Error sending SMS:", error);

    return {
      success: false,
      error: error.message || "Failed to send SMS",
    };
  }
};

// Send OTP function
export const sendOTP = async (
  phoneNumber: string,
  otp: string
): Promise<ISendSMSResponse> => {
  const message = `Your OTP is: ${otp}. Valid for 5 minutes. Do not share this code.`;
  return sendSMS(phoneNumber, message);
};