import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema.js';
import { Safe, SafeSchema } from './schemas/safe.schema.js';
import { UserService } from './user.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Safe.name, schema: SafeSchema }
    ])
  ],
  providers: [UserService],
  exports: [UserService, MongooseModule.forFeature([{ name: Safe.name, schema: SafeSchema }])]
})
export class UserModule {} 