import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { getOwnableValidator, getOwnableValidatorOwners, getSmartSessionsValidator } from '@rhinestone/module-sdk';
import { RpcService } from './rpc.service.js';
import { Address, Client, encodeFunctionData, Hex, parseAbi, parseEther, PublicClient, toBytes, toHex, prepareEncodeFunctionData } from 'viem';
import { PasskeyDto, SafeSessionConfigDto } from './safe.dtos.js';
import { PublicKey } from "ox";
import { generatePrivateKey } from 'viem/accounts';
import { privateKeyToAccount } from 'viem/accounts';
import { SafeSessionConfig } from '../user/schemas/safe.schema.js';

import {
  getWebAuthnValidator,
  WEBAUTHN_VALIDATOR_ADDRESS,
  getWebauthnValidatorMockSignature,
  getSmartSessionsValidator,
  OWNABLE_VALIDATOR_ADDRESS,
  getSudoPolicy,
  Session,
  getAccount,
  encodeSmartSessionSignature,
  getOwnableValidatorMockSignature,
  RHINESTONE_ATTESTER_ADDRESS,
  MOCK_ATTESTER_ADDRESS,
  encodeValidatorNonce,
  getOwnableValidator,
  encodeValidationData,
  getEnableSessionDetails,
} from '@rhinestone/module-sdk'
import { User } from '../user/schemas/user.schema.js';
import { getAccountNonce } from 'permissionless/actions';
import { entryPoint07Address, getUserOperationHash } from 'viem/account-abstraction';
// necessary imports

@Injectable()
export class Erc7579SafeService {

  private readonly logger = new Logger(Erc7579SafeService.name);

  private stateStore = new Map<Hex, any>();

  constructor(
    private configService: ConfigService,
    private rpcService: RpcService,
  ) {}

  createState(hash: Hex, obj: any): string {
    this.logger.verbose('createState Key', hash);
    this.stateStore.set(hash, obj);
    return hash;
  }

  retrieveState(hash: Hex): any {
    const obj = this.stateStore.get(hash);
    this.logger.verbose('retrieveState', obj);
    // this.stateStore.delete(hash);
    return obj;
  }

  deleteState(hash: Hex) {
    this.stateStore.delete(hash);
  }

  async installOwnableValidatorModule(smartAccountClient, owners: Hex[], threshold: number) {

    const pimlicoClient = this.rpcService.getPimlicoClient(smartAccountClient.chain.id);

    const ownableValidatorModule = getOwnableValidator({
        threshold: threshold,
        owners: owners,
    })
      
    this.logger.log(`Installing ownable validator module with threshold ${threshold} and owners ${owners}`);
    const opHash1 = await smartAccountClient.installModule(ownableValidatorModule);

    this.logger.log(`Waiting for user operation receipt for opHash: ${opHash1}`);
    const receipt = await pimlicoClient.waitForUserOperationReceipt({
      hash: opHash1,
    })

    if (receipt.success) {
      this.logger.log('Ownable validator module installed successfully', receipt);
    } else {
      this.logger.error(`Ownable validator module installation failed: ${receipt.reason}`);
      throw new Error(`Ownable validator module installation failed: ${receipt.reason}`);
    }

    // this.logger.log('Getting ownable validator owners after module installation');
    // const owners2 = await getOwnableValidatorOwners({
    //   client: publicClient as PublicClient,
    //   account: {
    //     address: smartAccountClient.account!.address,
    //     deployedOnChains: [publicClient.chain!.id],
    //     type: 'safe',
    //   },
    // });

    // this.logger.warn(`Ownable validator owners after module installation: ${JSON.stringify(owners2)}`);
  }

  async installWebAuthnModule(smartAccountClient, passkeyCredential: PasskeyDto) {

    this.logger.log(`Installing webauthn validator with pubKey: ${passkeyCredential.publicKey} and authenticatorId: ${passkeyCredential.id}`);

    const validator = getWebAuthnValidator({
      pubKey: passkeyCredential.publicKey,
      authenticatorId: passkeyCredential.id,
    });

    this.logger.warn('validator', validator);

    // Manual override
    // validator.address = "0x2f167e55d42584f65e2e30a748f41ee75a311414";
    // validator.module = "0x2f167e55d42584f65e2e30a748f41ee75a311414";
    
    const installOp = await smartAccountClient.installModule(validator);
    
    const receipt = await smartAccountClient.waitForUserOperationReceipt({
      hash: installOp,
    });

    if (receipt.success) {
      this.logger.log(`webauthn validator installed successfully: ${receipt}`);
    } else {
      this.logger.error(`webauthn validator installation failed: ${receipt}`);
      throw new Error(`webauthn validator installation failed: ${receipt}`);
    }

  }

  async installSessionsModule(smartAccountClient, sessions: Session[] = []) {

    this.logger.log(`Installing smart sessions validator`);

    const pimlicoClient = this.rpcService.getPimlicoClient(smartAccountClient.chain.id);

    const smartSessions = getSmartSessionsValidator(sessions ? {sessions} : {})
 
    const opHash = await smartAccountClient.installModule(smartSessions)
    
    const receipt = await pimlicoClient.waitForUserOperationReceipt({
      hash: opHash,
    })

    if (receipt.success) {
      this.logger.log(`smart sessions validator installed successfully: ${receipt}`);
    } else {
      this.logger.error(`smart sessions validator installation failed: ${receipt}`);
      throw new Error(`smart sessions validator installation failed: ${receipt}`);
    }
  }

  async configureSession(user: User, safeAddress: Hex, chainId: number, sessionConfigDto: SafeSessionConfigDto, privateKey: Hex | null = null) {

    this.logger.log(`Configuring sessions`);

    const smartAccountClient = await this.rpcService.getSmartAccountClient(chainId, safeAddress);

    const pk = privateKey || generatePrivateKey();

    const sessionOwner = privateKeyToAccount(pk)

    // address: '0x6D7A849791a8E869892f11E01c2A5f3b25a497B6',
    const transfer = prepareEncodeFunctionData({
      abi: [
        {
          inputs: [],
          name: 'getLastGreeter',
          outputs: [{ internalType: 'address', name: '', type: 'address' }],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [],
          name: 'greet',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'greet',
    })

    this.logger.warn('transfer', transfer);
 
    const session: Session = {
      sessionValidator: OWNABLE_VALIDATOR_ADDRESS,
      sessionValidatorInitData: encodeValidationData({
        threshold: 1,
        owners: [sessionOwner.address],
      }),
      salt: sessionConfigDto.salt ? toHex(toBytes(sessionConfigDto.salt, { size: 32 })) : toHex(toBytes('0', { size: 32 })),
      userOpPolicies: sessionConfigDto.userOpPolicies ? sessionConfigDto.userOpPolicies : [getSudoPolicy()],
      erc7739Policies: sessionConfigDto.erc7739Policies ? sessionConfigDto.erc7739Policies : {
        allowedERC7739Content: [],
        erc1271Policies: [],
      },
      actions: sessionConfigDto.actions,
      // [
        // {
          // actionTarget: '0x6D7A849791a8E869892f11E01c2A5f3b25a497B6' as Address, // an address as the target of the session execution
          // actionTargetSelector: '0xcfae3217' as Hex, // function selector to be used in the execution, in this case no function selector is used
          // actionPolicies: [getSudoPolicy()],
        // },
        // {
      //     actionTarget: "0x19575934a9542be941d3206f3ecff4a5ffb9af88" as Address,
      //     actionTargetSelector: "0xd09de08a" as Hex,
      //     actionPolicies: [getSudoPolicy()],
      //   },
      // ],
      chainId: BigInt(smartAccountClient.chain.id),
      permitERC4337Paymaster: true,
    }

    const publicClient = this.rpcService.getPublicClient(smartAccountClient.chain.id);

    const account = getAccount({
      address: smartAccountClient.account!.address,
      type: 'safe',
    })

    this.logger.warn(await smartAccountClient.isModuleInstalled(getSmartSessionsValidator({
      sessions: [session],
    })));
     
    const sessionDetails = await getEnableSessionDetails({
      sessions: [session],
      account,
      clients: [publicClient as PublicClient],
      enableValidatorAddress: WEBAUTHN_VALIDATOR_ADDRESS // WEBAUTHN_VALIDATOR_ADDRESS //0x2f167e55d42584f65e2e30a748f41ee75a311414,
    })

    this.logger.verbose(`Session details:`, sessionDetails);

    const hash = this.createState(sessionDetails.permissionEnableHash, sessionDetails);

    const safe = user.safesByChain.find(sbc => sbc.chainId === chainId)?.safes.find(s => s.safeAddress === safeAddress);

    if (!safe) {
      throw new Error('Safe not found');
    }

    safe.safeModuleSessionConfig?.push({
      sessionKey: pk,
      sessionConfigHash: hash,
    });

    await user.save();

    return {hash, passkeyId: JSON.parse(user.safesByChain.find(sbc => sbc.chainId === chainId)?.safes.find(s => s.safeAddress === safeAddress)?.safeModulePasskey!).id};

    // const config = sessionConfig || {
    //   owner: owner.address,
    //   threshold: 1,
    //   owners: [owner.address],
    // }


    // const opHash = await smartAccountClient.installModule(sessionConfig)
    
    


    // const sessionConfig = {
    //   owner: owner.address,
    //   threshold: 1,
    //   owners: [owner.address],
    // }
  }

  async signSessionCreation(user: User, safeAddress: Hex, chainId: number, hash: Hex, signature: Hex ) {

    this.logger.log(`Signing session creation`);

    const sessionDetails = this.retrieveState(hash);

    sessionDetails.enableSessionData.enableSession.permissionEnableSig = signature;

    console.log('sessionDetails', sessionDetails);

    const smartAccountClient = await this.rpcService.getSmartAccountClient(chainId, safeAddress);

    const publicClient = this.rpcService.getPublicClient(smartAccountClient.chain.id);

    const account = getAccount({
      address: smartAccountClient.account!.address,
      type: 'safe',
    })

    const smartSessions = getSmartSessionsValidator({})
    
    const nonce = await getAccountNonce(publicClient, {
      address: smartAccountClient.account!.address,
      entryPointAddress: entryPoint07Address,
      key: encodeValidatorNonce({
        account,
        validator: smartSessions,
      }),
    })
     
    sessionDetails.signature = getOwnableValidatorMockSignature({
      threshold: 1,
    })

    // sessionDetails.signature = getWebauthnValidatorMockSignature();



    // '0x6D7A849791a8E869892f11E01c2A5f3b25a497B6' as Address, // an address as the target of the session execution
    //       actionTargetSelector: '0xcfae3217' 


      const calls = [
        {
          to: '0x6D7A849791a8E869892f11E01c2A5f3b25a497B6',
          functionName: 'greet',
          abi: [
            {
              inputs: [],
              name: 'greet', 
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
          ],
          args: [],
        },
      ];

      // const executeOrderData = encodeFunctionData({
      //   abi: parseAbi(['function executeOrder(uint256, uint160, uint256, uint24)']),
      //   functionName: 'executeOrder',
      //   args: [1n, 1461446703485210103287273052203988822378723970341n, 0n, 3000],
      // })

    // const callData = encodeFunctionData({
    //   abi: [
    //     {
    //       inputs: [],
    //       name: 'greet', 
    //       outputs: [],
    //       stateMutability: 'nonpayable',
    //       type: 'function',
    //     },
    //   ],
    //   functionName: 'greet',
    //   args: [],
    // });

    const callData = encodeFunctionData({
      abi: parseAbi(['function greet()']),
      functionName: 'greet',
      args: [],
    });

    // const userOpConfig: PrepareUserOperationParameters = {
    //   account: smartAccountClient.account!,
    //   calls: calls,
    //   stateOverride: [
    //     {
    //       // Adding 100 ETH to the smart account during estimation to prevent AA21 errors while estimating
    //       balance: parseEther("100"),
    //       address: smartAccountClient.account!.address,
    //     },
    //   ],
    //   nonce: BigInt(userOperationDto.nonce),
    // }

    // if (signature) {
    //   userOpConfig.signature = signature;
    // }

    // const userOperation = await smartAccountClient.prepareUserOperation(userOpConfig);
     
    const userOperation = await smartAccountClient.prepareUserOperation({
      account: smartAccountClient.account!,
      calls: [
        {
          to: "0x19575934a9542be941d3206f3ecff4a5ffb9af88",
          value: BigInt(0),
          data: "0xd09de08a",
        }
      ],
      // calls,
      // calls: [
      //   {
      //     to: '0x6D7A849791a8E869892f11E01c2A5f3b25a497B6' as Address, //session.actions[0].actionTarget,
      //     value: BigInt(0),
      //     data: callData, // session.actions[0].actionTargetSelector,
      //   },
      // ],
      stateOverride: [
        {
          // Adding 100 ETH to the smart account during estimation to prevent AA21 errors while estimating
          balance: parseEther("100"),
          address: smartAccountClient.account!.address,
        },
      ],
      nonce,
      signature: encodeSmartSessionSignature(sessionDetails),
    })

    const userOpHashToSign = getUserOperationHash({
      chainId: smartAccountClient.chain.id,
      entryPointAddress: entryPoint07Address,
      entryPointVersion: '0.7',
      userOperation,
    })

    const pk = user.safesByChain.find(sbc => sbc.chainId === chainId)?.safes.find(s => s.safeAddress === safeAddress)?.safeModuleSessionConfig?.find(sc => sc.sessionConfigHash === hash)?.sessionKey;

    this.logger.warn('pk', pk);

    const sessionOwner = privateKeyToAccount(pk as Hex);
     
    sessionDetails.signature = await sessionOwner.signMessage({
      message: { raw: userOpHashToSign },
    })
     
    userOperation.signature = encodeSmartSessionSignature(sessionDetails)

    const userOpHash = await smartAccountClient.sendUserOperation(userOperation)

    const pimlicoClient = this.rpcService.getPimlicoClient(smartAccountClient.chain.id);
 
    const receipt = await pimlicoClient.waitForUserOperationReceipt({
      hash: userOpHash,
    })

    if (receipt.success) {
      this.logger.log(`Session creation signed successfully: ${receipt}`);
    } else {
      this.logger.error(`Session creation signing failed: ${receipt}`);
      throw new Error(`Session creation signing failed: ${receipt}`);
    }

    return {hash: receipt.userOpHash};

  }

  async isModuleInstalled(chainId: number, safeAddress: Hex, moduleAddress: Hex, type: 'executor' | 'validator' = 'executor') {
    const smartAccountClient = await this.rpcService.getSmartAccountClient(chainId, safeAddress);
    const isModuleInstalled =
      (await smartAccountClient.isModuleInstalled({
        address: moduleAddress,
        type: type,
        context: '0x'
    }))
  
    return isModuleInstalled
  }
} 
