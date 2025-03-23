import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema.js';
import { Hex, isAddress } from 'viem';
import { SafeConfigResultDto } from '../safe/safe.dtos.js';
import { Safe, SafeSessionConfig } from './schemas/safe.schema.js';
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

  async getSessionDetails(safeAddress: Hex, chainId: number): Promise<SafeSessionConfig[] | null> {
    const user = await this.userModel.findOne({ safesByChain: { $elemMatch: { chainId: Number(chainId), safes: { $elemMatch: { safeAddress: safeAddress } } } } });
    const safe = user?.safesByChain.find(sbc => sbc.chainId === Number(chainId))?.safes.find(s => s.safeAddress === safeAddress);
    return safe?.safeModuleSessionConfig || null;
  }

  async activateEndpoint(path: string, safeAddress: Hex, chainId: number, active: boolean): Promise<boolean> {
    const user = await this.userModel.findOneAndUpdate(
      { 
        safesByChain: { 
          $elemMatch: { 
            chainId: Number(chainId), 
            safes: { $elemMatch: { safeAddress: safeAddress } } 
          } 
        },
        "safesByChain.safes.safeModuleSessionConfig.endpoint.url": path
      },
      {
        $set: {
          "safesByChain.$[chain].safes.$[safe].safeModuleSessionConfig.$[config].endpoint.active": active
        }
      },
      {
        arrayFilters: [
          { "chain.chainId": Number(chainId) },
          { "safe.safeAddress": safeAddress },
          { "config.endpoint.url": path }
        ],
        new: true
      }
    );

    console.log('USER', user);
    return user ? true : false;
  }

  async verifyEndpoint(path: string): Promise<{ session: { sessionKey: string, sessionDetails: string }, safeAddress: string, chainId: number } | null> {
    const result = await this.userModel.aggregate([
      {
        $match: {
          'safesByChain.safes.safeModuleSessionConfig.endpoint.url': path,
          'safesByChain.safes.safeModuleSessionConfig.endpoint.active': true
        }
      },
      {
        $unwind: '$safesByChain'
      },
      {
        $unwind: '$safesByChain.safes'
      },
      {
        $project: {
          _id: 0,
          session: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$safesByChain.safes.safeModuleSessionConfig',
                  as: 'config',
                  cond: {
                    $and: [
                      { $eq: ['$$config.endpoint.url', path] },
                      { $eq: ['$$config.endpoint.active', true] }
                    ]
                  }
                }
              },
              0
            ]
          },
          safeAddress: '$safesByChain.safes.safeAddress',
          chainId: '$safesByChain.chainId',
          // sessionDetails: {
          //   $arrayElemAt: [
          //     {
          //       $filter: {
          //         input: '$safesByChain.safes.safeModuleSessionConfig',
          //         as: 'config',
          //         cond: {
          //           $and: [
          //             { $eq: ['$$config.endpoint.url', path] },
          //             { $eq: ['$$config.endpoint.active', true] }
          //           ]
          //         }
          //       }
          //     },
          //     0
          //   ]
          // }
        }
      }
    ]).exec();

    console.log('RESULT', result);

    const filteredResult = result.filter(r => r.session);

    return filteredResult.length > 0 ? filteredResult[0] : null;
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