/* eslint-disable @typescript-eslint/no-explicit-any */

// Firebase / FCM is not used in this project anymore.
// This helper is kept as a no-op so callers don't crash.

export const sendPushToTokens = async (
  tokens: string[],
  title: string,
  body: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  data?: Record<string, any>,
) => {
  if (!tokens?.length) {
    return { successCount: 0, failureCount: 0, responses: [] as any[] };
  }

  console.log("sendPushToTokens called (push disabled):", {
    tokensCount: tokens.length,
    title,
    body,
  });

  return {
    successCount: 0,
    failureCount: tokens.length,
    responses: [] as any[],
  };
};
