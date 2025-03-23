import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module.js';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { SafeModule } from './safe/safe.module.js';
import { PublicModule } from './public/public.module.js';
@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost/safe'),
    UserModule,
    AuthModule,
    SafeModule,
    PublicModule, 
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
