import { Module } from '@nestjs/common';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';
import { UserModule } from '../user/user.module.js';
import { SafeModule } from '../safe/safe.module.js';

@Module({
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
  imports: [
    UserModule,
    SafeModule,
  ],
})
export class PublicModule {} 