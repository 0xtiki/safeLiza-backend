import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module.js';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { SafeModule } from './safe/safe.module.js';
@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost/safe'),
    UserModule,
    AuthModule,
    SafeModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
