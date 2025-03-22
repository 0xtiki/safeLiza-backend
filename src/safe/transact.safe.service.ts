import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encodeFunctionData, Hex, parseEther, stringify } from 'viem';
import { getChainSlug } from '../utils/pimlico.js';
import { RpcService } from './rpc.service.js';
import { TransactSafeDto, UserOperationCallDto, UserOperationDto } from './safe.dtos.js';
import { SmartAccountClient } from 'permissionless';
import { getContractABI } from '../utils/etherscan.js';
import { entryPoint07Address, getUserOperationHash, PrepareUserOperationParameters } from 'viem/account-abstraction';
import { WEBAUTHN_VALIDATOR_ADDRESS, encodeValidatorNonce, getAccount, getWebAuthnValidator, getWebauthnValidatorMockSignature } from '@rhinestone/module-sdk';
import { getAccountNonce } from 'permissionless/actions';
import { UserService } from '../user/user.service.js';
import { UserOperation } from '@safe-global/safe-core-sdk-types';
import { User } from '../user/schemas/user.schema.js';

@Injectable()
export class TransactSafeService {
  private readonly logger = new Logger(TransactSafeService.name);

  // TODO: needs cron job to clear stateStore for expired user operations
  private stateStore = new Map<Hex, any>();

  constructor(
    private configService: ConfigService,
    private rpcService: RpcService,
    private userService: UserService,
  ) {}

  // async transactSafe(address: Hex, chainId: number, data: TransactSafeDto) {
  //   const apiKey = this.configService.get('PIMLICO_API_KEY');
  //   if (!apiKey) throw new Error('Missing PIMLICO_API_KEY');

  //   const chainSlug = getChainSlug(chainId);
  //   if (!chainSlug) throw new Error('Unsupported chain');

  //   const {smartAccountClient, privateKey} = await this.rpcService.createSmartAccountClient({
  //     chainId,
  //   });

  //   const txHashMultiple = await smartAccountClient.sendTransaction({
  //     calls: data.calls,
  //   });

  //   console.log(
  //     `User operation with multiple transactions included: https://sepolia.etherscan.io/tx/${txHashMultiple}`,
  //   );

  //   const pimlicoClient = this.rpcService.getPimlicoClient(chainId);

  //   const receipt = await pimlicoClient.waitForUserOperationReceipt({
  //     hash: txHashMultiple,
  //   });

  //   console.log(receipt);

  //   return txHashMultiple;
  // }

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

  async executeSignedUserOperation(encodedSignature: Hex, userOpHashToSign: Hex, safeAddress: Hex, chainId: number) {

    this.logger.log('Executing signed user operation');

    this.logger.debug('userOpHashToSign', userOpHashToSign);

    const userOperation = this.retrieveState(userOpHashToSign);

    this.logger.verbose('userOperation', userOperation);

    userOperation.signature = encodedSignature;

    const smartAccountClient = await this.rpcService.getSmartAccountClient(chainId, safeAddress);
    
    const userOpHash = await smartAccountClient.sendUserOperation(userOperation);
  
    const receipt = await smartAccountClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });

    this.logger.verbose('receipt', receipt);

    if (receipt.success) {
      this.deleteState(userOpHashToSign);
    }

    return stringify(receipt);
  }

  async createSafePasskeyUserOperation(user: User, safeAddress: Hex, chainId: number, calls: UserOperationCallDto[], passkeyId: string) {
    const publicClient = this.rpcService.getPublicClient(chainId);

    // const user = await this.userService.findByPasskeyId(passkeyId);

    this.logger.verbose('user', user);

    const hexKey = user?.passkey?.publicKeyHex as Hex;

    const validator = getWebAuthnValidator({
      pubKey: hexKey,
      authenticatorId: passkeyId,
      // hook: WEBAUTHN_VALIDATOR_ADDRESS,
    });

    this.logger.warn(WEBAUTHN_VALIDATOR_ADDRESS);

    this.logger.verbose('validator', validator);

    const nonce = await getAccountNonce(publicClient, {
      address: safeAddress,
      entryPointAddress: entryPoint07Address,
      key: encodeValidatorNonce({
        account: getAccount({
          address: safeAddress,
          type: "safe",
        }),
        validator,
      }),
    });

    this.logger.verbose('nonce', nonce);

    const smartAccountClient = await this.rpcService.getSmartAccountClient(chainId, safeAddress);
    const userOperationDto = {
      nonce: nonce.toString(),
      calls: calls,
    }
    const userOperation = await this.prepareUserOperation(userOperationDto, smartAccountClient, getWebauthnValidatorMockSignature());

    return userOperation;
  }

  async prepareUserOperation(userOperationDto: UserOperationDto, smartAccountClient: any, signature?: Hex): Promise<{userOperation: any, userOpHashToSign: string}> {

    this.logger.verbose('prepareUserOperation', userOperationDto);

    const calls = await Promise.all(
      userOperationDto.calls.map(async (call) => {
        if (call.data) {
          // If data field is present, return it as is
          return {
            to: call.to,
            data: call.data,
          };
        } else {
          // If functionName, abi, and args fields are present, encode the function data
          let abi = call.abi;
          if (!abi) {
            try {
              abi = await getContractABI(call.to);
              // await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (error) {
              this.logger.error(`Failed to fetch ABI for contract ${call.to}: ${error}`);
            }
          }

          return {
            to: call.to,
            data: encodeFunctionData({
              abi: abi ? abi : [],
              functionName: call.functionName,
              args: call.args || [],
            }),
          };
        }
      })
    );

    this.logger.verbose('calls', calls);

    const userOpConfig: PrepareUserOperationParameters = {
      account: smartAccountClient.account!,
      calls: calls,
      stateOverride: [
        {
          // Adding 100 ETH to the smart account during estimation to prevent AA21 errors while estimating
          balance: parseEther("100"),
          address: smartAccountClient.account!.address,
        },
      ],
      nonce: BigInt(userOperationDto.nonce),
    }

    if (signature) {
      userOpConfig.signature = signature;
    }

    const userOperation = await smartAccountClient.prepareUserOperation(userOpConfig);

    // this.logger.verbose('userOperation', userOperation);

    const userOpHashToSign = getUserOperationHash({
      chainId: smartAccountClient.chain!.id,
      entryPointAddress: entryPoint07Address,
      entryPointVersion: '0.7',
      userOperation,
    })

    this.logger.verbose('userOpHashToSign', userOpHashToSign);

    this.createState(userOpHashToSign, userOperation);

    return {userOperation, userOpHashToSign};
  }

  async executeOrderUserOperation(userOperation: any, userOpHashToSign: string, safeAddress: Hex, chainId: number) {

    this.logger.log('Executing order user operation');    
  }
} 
