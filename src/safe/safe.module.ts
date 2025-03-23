import { Module } from '@nestjs/common';
import { ConfigSafeService } from './config.safe.service.js';
import { TransactSafeService } from './transact.safe.service.js';
import { SafeController } from './safe.controller.js';
import { RpcService } from './rpc.service.js';
import { ConfigModule } from '@nestjs/config';
import { Erc7579SafeService } from './erc7579.safe.service.js';
import { UserModule } from '../user/user.module.js';
@Module({
  imports: [ConfigModule.forRoot(), UserModule],
  providers: [ConfigSafeService, TransactSafeService, Erc7579SafeService, RpcService],
  controllers: [SafeController],
  exports: [RpcService],
})
export class SafeModule {} 