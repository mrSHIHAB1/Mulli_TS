/* eslint-disable @typescript-eslint/no-explicit-any */
import passport, { Profile } from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import {
  Strategy as GoogleStrategy,
  VerifyCallback,
} from "passport-google-oauth20";
import { Strategy as AppleStrategy } from "passport-apple";
import bcrypt from "bcryptjs";




import { envVars } from "./env";
import { User } from "../modules/user/user.model";
import { AuthProviderType, Role } from "../modules/user/user.interface";

// ✅ Local strategy (BLOCK oauth accounts)
passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email }).select("+password");
        if (!user) return done(null, false, { message: "Invalid email or password" });

        if (user.isDeleted) return done(null, false, { message: "User deleted" });

        if (user.isblocked) return done(null, false, { message: "User is blocked" });

        const isMatch = await bcrypt.compare(password, user.password || "");
        if (!isMatch) return done(null, false, { message: "Invalid email or password" });

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// ✅ Google strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: envVars.GOOGLE_AUTH.GOOGLE_CLIENT_ID,
      clientSecret: envVars.GOOGLE_AUTH.GOOGLE_CLIENT_SECRET,
      callbackURL: envVars.GOOGLE_AUTH.GOOGLE_CALLBACK_URL,
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done: VerifyCallback
    ) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        if (!email) return done(null, false, { message: "No email found from Google" });

        let user = await User.findOne({ email });

        if (user && user.isDeleted) return done(null, false, { message: "User is deleted" });

        if (!user) {
          // Create new user
          user = await User.create({
            email,
            name: profile.displayName,
            picture: profile.photos?.[0]?.value,
            role: Role.DRIVER,
            isVerified: true,
            auth_providers: [
              { provider: AuthProviderType.GOOGLE, providerID: profile.id },
            ],
          });
        } else {
          // Add Google provider if missing
          const hasGoogle = user.auth_providers?.some(
            (p: any) => p.provider === AuthProviderType.GOOGLE
          );
          if (!hasGoogle) {
            await User.updateOne(
              { _id: user._id },
              {
                $addToSet: {
                  auth_providers: {
                    provider: AuthProviderType.GOOGLE,
                    providerID: profile.id,
                  },
                },
              }
            );
          }
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.use(
  new AppleStrategy(
    {
      clientID: envVars.APPLE_AUTH.APPLE_CLIENT_ID, // Service ID
      teamID: envVars.APPLE_AUTH.APPLE_TEAM_ID,
      keyID: envVars.APPLE_AUTH.APPLE_KEY_ID,
      privateKeyString: envVars.APPLE_AUTH.APPLE_PRIVATE_KEY_PATH,
      callbackURL: envVars.APPLE_AUTH.APPLE_CALLBACK_URL,
      scope: ["name", "email"],
      passReqToCallback: false,
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      idToken: any,
      profile: any,
      done: any,
    ) => {
      try {
        // Apple unique id => idToken.sub
        const appleId = idToken?.sub || profile?.id;
        const email = profile?.email; // often only first time
        const fullName = profile?.name
          ? `${profile.name.firstName ?? ""} ${profile.name.lastName ?? ""}`.trim()
          : undefined;

        if (!appleId)
          return done(null, false, { message: "No Apple user id found" });

        // ✅ Find by provider first
        let user = await User.findOne({
          "auth_providers.provider": AuthProviderType.APPLE,
          "auth_providers.providerID": appleId,
        });

        // fallback by email (only if present)
        if (!user && email) user = await User.findOne({ email });

        if (user && user.isDeleted)
          return done(null, false, { message: "User is deleted" });

        if (!user) {
          user = await User.create({
            email: email ?? undefined,
            name: fullName ?? "Apple User",
            role: Role.DRIVER,
            isVerified: true,
            auth_providers: [
              { provider: AuthProviderType.APPLE, providerID: appleId },
            ],
          });
        } else {
          const hasApple = user.auth_providers?.some(
            (p: any) => p.provider === AuthProviderType.APPLE,
          );

          if (!hasApple) {
            await User.updateOne(
              { _id: user._id },
              {
                $addToSet: {
                  auth_providers: {
                    provider: AuthProviderType.APPLE,
                    providerID: appleId,
                  },
                },
              },
            );
          }

          // store email/name if missing (first-time only issue)
          const update: any = {};
          if (!user.email && email) update.email = email;
          if (
            (!user.name || user.name === "Apple User") &&
            fullName
          ) {
            update.name = fullName;
          }
          if (Object.keys(update).length) {
            await User.updateOne({ _id: user._id }, update);
          }
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ),
);

export default passport;
