import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encodeValidatorNonce, Module } from '@rhinestone/module-sdk';
import { createSafeClient } from '@safe-global/sdk-starter-kit';
import { getAccountNonce } from 'permissionless/actions';
import { RpcService } from './rpc.service.js';
import { safeAbi } from '../utils/abi/safe.abi.js';
import { Hex } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';
import { TransactSafeService } from './transact.safe.service.js';
// import { SafeSigner } from '@safe-global/protocol-kit';
import { privateKeyToAccount } from 'viem/accounts';
import { SafeOwnerConfig } from './Types.js';
import { SafeConfigDto, SafeConfigResultDto } from './safe.dtos.js';
import * as crypto from 'crypto';
import { Erc7579SafeService } from './erc7579.safe.service.js';
import { getUnspendableAddress } from '../utils/smartAccount.js';

// necessary imports

interface GetAccountNonceArgs {
  address: Hex;
  entryPointAddress: Hex;
  key?: bigint;
}

@Injectable()
export class ConfigSafeService {

  private readonly logger = new Logger(ConfigSafeService.name);

  constructor(
    private configService: ConfigService,
    private rpcService: RpcService,
    private transactSafeService: TransactSafeService,
    private erc7579SafeService: Erc7579SafeService,
  ) {}
  
  async configSafe(config: SafeConfigDto) {

    if (!config.multisig && !config.passkey) {
      throw new Error('Multisig or passkey is required');
    }

    const saltBuffer = crypto.randomBytes(32);
    const saltHex = '0x' + saltBuffer.toString('hex');

    // let lastClient;
    // let lastOwners;

    const results: SafeConfigResultDto = {};

    for (const chainId of config.chains) {

      console.log('deploying Safe on chainId ', chainId);

      const { smartAccountClient, privateKey } = await this.rpcService.createSmartAccountClient({
        chainId: Number(chainId),
        privateKey: this.configService.get('PRIVATE_KEY') as Hex, 
        saltNonce: BigInt(saltHex)
      });

      if (config.multisig && config.multisig.owners.length > 0) {
        await this.erc7579SafeService.installOwnableValidatorModule(smartAccountClient, config.multisig.owners as Hex[], config.multisig.threshold);
      }

      if (config.passkey) {
        await this.erc7579SafeService.installWebAuthnModule(smartAccountClient, config.passkey);
      }

      await this.erc7579SafeService.installSessionsModule(smartAccountClient);
      
      // brick safe
      const safeAddress = smartAccountClient.account!.address;
      const ownerToRemove = privateKeyToAccount(privateKey).address;
      const unspendableAddress = getUnspendableAddress();

      const addOwnerConfig: SafeOwnerConfig = {
        safeAddress,
        ownerAddressToAddOrRemove: unspendableAddress,
        chainId: Number(chainId),
        threshold: 1,
        signer: privateKey
      }

      await this.addSafeOwner(addOwnerConfig);

      const removeOwnerConfig: SafeOwnerConfig = {
        safeAddress,
        ownerAddressToAddOrRemove: ownerToRemove,
        chainId: Number(chainId),
        threshold: 1,
        signer: privateKey
      }

      await this.removeSafeOwner(removeOwnerConfig);

      const safeOwnersAfter = await this.getSafeOwners(Number(chainId), smartAccountClient.account!.address as Hex);

      this.logger.warn(`Safe owners after brick (unspendable owner ${unspendableAddress}):`, safeOwnersAfter);

      // lastClient = smartAccountClient;
      // lastOwners = safeOwnersAfter;

      results[chainId] = {
        safeAddress: smartAccountClient.account!.address,
        safeLegacyOwners: safeOwnersAfter ? safeOwnersAfter : [],
        safeModuleOwners: config.multisig && config.multisig.owners ? config.multisig.owners : [],
        safeModulePasskey: config.passkey ? JSON.stringify(config.passkey) : undefined,
      };
    }

    return results;
  }

  // Can only be done via Safe transaction (direct call to Safe contract, not possible via user operation)
  async removeSafeOwner(config: SafeOwnerConfig) {
    
    const safeClient = await createSafeClient({
      provider: this.rpcService.getRpcUrl(config.chainId),
      signer: config.signer ? config.signer : this.configService.get('PRIVATE_KEY') as Hex,
      safeAddress: config.safeAddress,
    })

    const transaction = await safeClient.createRemoveOwnerTransaction({
      ownerAddress: config.ownerAddressToAddOrRemove,
      threshold: config.threshold ? config.threshold : 1
    })
    
    const txResult = await safeClient.send({
      transactions: [transaction]
    })

    const publicClient = this.rpcService.getPublicClient(config.chainId);
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txResult.transactions?.ethereumTxHash as Hex 
    });

    this.logger.warn(`safe remove owner tx hash ${txResult.transactions?.ethereumTxHash}, receipt ${receipt}`)

    return txResult;
  }

  async addSafeOwner(config: SafeOwnerConfig) {
    const safeClient = await createSafeClient({
      provider: this.rpcService.getRpcUrl(config.chainId),
      signer: config.signer ? config.signer : this.configService.get('PRIVATE_KEY') as Hex,
      safeAddress: config.safeAddress,
    })

    const transaction = await safeClient.createAddOwnerTransaction({
      ownerAddress: config.ownerAddressToAddOrRemove,
      threshold: config.threshold ? config.threshold : 1
    })

    this.logger.debug(`safe add owner transaction: ${transaction}`);
    
    const txResult = await safeClient.send({
      transactions: [transaction]
    })

    this.logger.debug(`safe add owner tx result: ${txResult}`);

    const publicClient = this.rpcService.getPublicClient(config.chainId);
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txResult.transactions?.ethereumTxHash as Hex 
    });

    this.logger.warn(`safe add owner tx hash ${txResult.transactions?.ethereumTxHash}, receipt ${receipt}`)
    return txResult;
  }

  // Adds a safe owner via user operation, i.e. can be gas sponsored
  // Returns the user operation and the hash to sign but does not execute it
  // Example how to execute:
  // userOperation.signature = await pkAccount.signMessage({
  //   message: { raw: userOpHashToSign },
  // })
  // const userOpHash = await smartAccountClient.sendUserOperation(userOperation);
  // const receipt = await pimlicoClient.waitForUserOperationReceipt({
  //   hash: userOpHash,
  // })
  async addSafeOwnerUserOp(smartAccountClient, ownerAddressToAdd: Hex, validatorModule: Module | null = null) {

    const publicClient = this.rpcService.getPublicClient(smartAccountClient.chain.id);

    const getAccountNonceArgs: GetAccountNonceArgs = {
      address: smartAccountClient.account!.address,
      entryPointAddress: entryPoint07Address,
    }

    if (validatorModule) {
      getAccountNonceArgs.key = encodeValidatorNonce({ account: smartAccountClient.account!, validator: validatorModule as Module });
    }

    const nonce = await getAccountNonce(publicClient, getAccountNonceArgs);

    const {userOperation, userOpHashToSign} = await this.transactSafeService.prepareUserOperation({
      nonce: nonce.toString(),
      calls: [
        {
          to: smartAccountClient.account!.address,
          functionName: 'addOwnerWithThreshold',
          abi: safeAbi,
          args: [ownerAddressToAdd, 1],
        },
      ],
    }, smartAccountClient);

    return {
      userOperation,
      userOpHashToSign,
    };
  }

  async getSafeOwners(chainId: number, safeAddress: Hex) {
    this.logger.log(`Calling getOwners function on safe contract`);

    const publicClient = this.rpcService.getPublicClient(chainId);

    const safeOwners = await publicClient.readContract({
      address: safeAddress,
      abi: safeAbi,
      functionName: 'getOwners',
    }) as Hex[];

    return safeOwners;
  }

  async signWithPk(message: Hex) {
    const pkAccount = privateKeyToAccount(this.configService.get('PRIVATE_KEY') as Hex);
    return await pkAccount.signMessage({
      message: { raw: message },
    })
  }
} 

