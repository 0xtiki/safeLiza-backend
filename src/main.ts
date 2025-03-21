import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet());

  app.set('trust proxy', true);

  // Enable CORS with specific origin
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  app.use(cookieParser());

  app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      req.headers['x-forwarded-host'] = 'localhost:3000';
      req.headers['x-forwarded-proto'] = 'http';
    }
    next();
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'my-secret',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      name: 'connect.sid',
      store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/safe',
        collectionName: 'sessions',
      }),
      cookie: {
        sameSite: 'lax',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        secure: false,
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // app.use((req, res, next) => {
  //   console.log('logging middleware:');
  //   console.log(req.sessionID);
  //   console.log(req.session);
  //   console.log(req.headers.cookie);
  //   console.log(req.headers.origin);
  //   next();
  // });

  await app.listen(process.env.PORT ?? 3030);
}
bootstrap();
