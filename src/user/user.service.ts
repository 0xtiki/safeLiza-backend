import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema.js';
import { isAddress } from 'viem';
import { SafeConfigResultDto } from '../safe/safe.dtos.js';
import { Safe } from './schemas/safe.schema.js';
@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Safe.name) private safeModel: Model<Safe>
  ) {}

  async findByPasskeyId(id: string): Promise<User | null> {
    return this.userModel.findOne({ 'passkey.id': id }).exec();
  }

  async findByEthAddress(address: string): Promise<User | null> {
    return this.userModel.findOne({ ethAddress: address }).exec();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async createWithPasskey(user: {username: string, id: string}, passkey: { id: string; publicKeyPem: string }): Promise<User> {

    console.log('PASSKEY', passkey);
    console.log('USERID', user.id);

    const newUser = new this.userModel({ customId: user.id, username: user.username, passkey });
    return newUser.save();
  }

  async createWithEthAddress(ethAddress: string): Promise<User> {
    const user = new this.userModel({ ethAddress });
    return user.save();
  }

  async addSafe(identifier: string, safeConfig: SafeConfigResultDto): Promise<User | null> {

    let user: User | null = null;

    for (const chainId in safeConfig) {
      const safeAddress = safeConfig[chainId].safeAddress;
      const safeLegacyOwners = safeConfig[chainId].safeLegacyOwners;
      const safeModuleOwners = safeConfig[chainId].safeModuleOwners;
      const safeModulePasskey = safeConfig[chainId].safeModulePasskey;

      if (isAddress(identifier)) {
        user = await this.userModel.findOne({ ethAddress: identifier });
      } else {
        user = await this.userModel.findOne({ ethAddress: identifier });
      }

      if (user) {
        const safeData = { safeAddress, chainId: Number(chainId), safeLegacyOwners, safeModuleOwners, safeModulePasskey };
        const safesByChain = user.safesByChain.find(sbc => sbc.chainId === Number(chainId));
        if (safesByChain) {
          safesByChain.safes.push(new this.safeModel(safeData));
        } else {
          user.safesByChain.push({ chainId: Number(chainId), safes: [new this.safeModel(safeData)] });
        }
        return user.save();
      } else {
        throw new Error('User not found for Ethereum address');
      }
    }
    return user;
  }

  async findOneByCustomId(customId: string): Promise<User | null> {
    return this.userModel.findOne({ customId }).exec();
  }

  async updateUser(user: User): Promise<User> {
    return user.save();
  }
} 