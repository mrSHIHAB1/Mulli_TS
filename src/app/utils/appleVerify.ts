import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const client = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export const verifyAppleToken = (idToken: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getKey,
      {
        issuer: "https://appleid.apple.com",
        algorithms: ["RS256"],
        audience: process.env.APPLE_CLIENT_ID, // your bundle/service id
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      }
    );
  });
};