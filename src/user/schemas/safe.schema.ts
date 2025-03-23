import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export class SafeSessionConfig {
  @Prop()
  sessionKey!: string;

  @Prop()
  permissionEnableHash!: string;

  @Prop()
  permissionId!: string;

  @Prop()
  sessionDetails!: string;

  @Prop({ type: Object })
  endpoint!: { active: boolean, url: string };
}



@Schema({ _id: false })
export class Safe extends Document {
  @Prop({ required: true })
  safeAddress!: string;

  @Prop({ required: true })
  chainId!: number;

  @Prop({ type: [String], default: [] })
  safeLegacyOwners!: string[];

  @Prop({ type: [String], default: [] })
  safeModuleOwners!: string[];

  @Prop()
  safeModulePasskey?: string;

  @Prop({ type: [SafeSessionConfig] })
  safeModuleSessionConfig?: SafeSessionConfig[];
}

export const SafeSchema = SchemaFactory.createForClass(Safe); 