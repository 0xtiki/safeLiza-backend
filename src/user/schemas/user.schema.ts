import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Safe } from './safe.schema.js';

@Schema({ _id: false })
class Passkey {
  // @Prop({ required: true })
  // name!: string;

  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  publicKeyPem!: string;

  @Prop({ required: false })
  publicKeyHex!: string;
}

@Schema({ _id: false })
class SafesByChain {
  @Prop({ required: true })
  chainId!: number;

  @Prop({ type: [Safe], default: [] })
  safes!: Safe[];
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  customId!: string;

  @Prop({ required: true, unique: true })
  username!: string;

  @Prop({ type: Passkey })
  passkey?: Passkey;

  @Prop()
  ethAddress?: string;

  @Prop({ type: [SafesByChain], default: [] })
  safesByChain!: SafesByChain[];
}

export const UserSchema = SchemaFactory.createForClass(User); 