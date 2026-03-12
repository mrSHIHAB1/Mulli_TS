/* eslint-disable @typescript-eslint/no-explicit-any */
import { fcmMessaging } from "../config/firebase.config";

const toStringMap = (data?: Record<string, any>) => {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const k of Object.keys(data)) {
    const v = data[k];
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
};

export const sendPushToTokens = async (
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>,
) => {
  if (!tokens?.length) return { successCount: 0, failureCount: 0 };

  const res = await fcmMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: toStringMap(data),
  });

  return {
    successCount: res.successCount,
    failureCount: res.failureCount,
    responses: res.responses,
  };
};
