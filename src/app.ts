import express, { Request, Response } from 'express'
import cookieParser from "cookie-parser";
import cors from "cors";
import { envVars } from './app/config/env';

import expressSession from "express-session";
import { globalErrorHandler } from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import router from './app/routes';
import { RedisStore } from "connect-redis";
import { redisClient } from './app/config/redis.config';

import passport from 'passport';
import './app/config/passport.config';
const app = express();

app.use(
    expressSession({
        store: new RedisStore({ client: redisClient }),
        secret: envVars.EXPRESS_SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
    })
);
app.use(passport.initialize());
app.use(passport.session());

app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: ['http://localhost:3000',"http://localhost:5173","http://localhost:5174","http://localhost:5175"],
    credentials: true,
}))

app.use("/api/v1", router)
app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
        message: "Reid Recovery"
    })
})

app.use(globalErrorHandler)

app.use(notFound)
export default app;