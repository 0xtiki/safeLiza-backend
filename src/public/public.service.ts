import { Injectable, Logger } from '@nestjs/common';
import { AgentAccessDto } from './public.controller.js';
import { Hex } from 'viem';
import { RpcService } from '../safe/rpc.service.js';
import { getAccountNonce } from 'permissionless/actions';
import { encodeSmartSessionSignature, getOwnableValidatorMockSignature, encodeValidatorNonce, getAccount, getSmartSessionsValidator, SmartSessionMode } from '@rhinestone/module-sdk';
import { entryPoint07Address, getUserOperationHash } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    private readonly rpcService: RpcService
  ) {}

  async executeCall(call: {to: string, value: bigint, data: string}, safeData: { session: { sessionKey: string, sessionDetails: string }, safeAddress: string, chainId: number }) {

    const { session, safeAddress, chainId } = safeData;

    const sessionDetailsParsed = JSON.parse(session.sessionDetails)

    const publicClient = this.rpcService.getPublicClient(chainId);

    const nonce = await getAccountNonce(publicClient, {
        address: safeAddress,
        entryPointAddress: entryPoint07Address,
        key: encodeValidatorNonce({
          account: getAccount({
            address: safeAddress,
            type: "safe",
          }),
          validator: getSmartSessionsValidator({}),
        }),
    });

    const smartAccountClient = await this.rpcService.getSmartAccountClient(chainId, safeAddress as Hex);
       
    const userOperation = await smartAccountClient.prepareUserOperation({
        account: smartAccountClient.account!,
        calls: [call],
        nonce,
        signature: encodeSmartSessionSignature({
            mode: SmartSessionMode.USE,
            permissionId: sessionDetailsParsed.permissionId as Hex,
            signature: getOwnableValidatorMockSignature({
                threshold: 1,
            })
        }),
    })
  

    const userOpHashToSign = getUserOperationHash({
        chainId: chainId,
        entryPointAddress: entryPoint07Address,
        entryPointVersion: '0.7',
        userOperation,
    })

    const sessionOwner = privateKeyToAccount(session.sessionKey as Hex)
       
    const userOpSignature = await sessionOwner.signMessage({
        message: { raw: userOpHashToSign },
    })
       
    userOperation.signature = encodeSmartSessionSignature({
        mode: SmartSessionMode.USE,
        permissionId: sessionDetailsParsed.permissionId as Hex,
        signature: userOpSignature,
    });

    const userOpHash = await smartAccountClient.sendUserOperation(userOperation)

    const pimlicoClient = this.rpcService.getPimlicoClient(chainId);

    const receipt = await pimlicoClient.waitForUserOperationReceipt({
        hash: userOpHash,
    })

    const txHash = receipt.receipt.transactionHash;

    this.logger.log(`User operation sent: ${txHash.toString()}`);

    return txHash.toString();
  }

  async agentAccess(path: string, safeData: { session: { sessionKey: string, sessionDetails: string }, safeAddress: string, chainId: number }, body: AgentAccessDto) {
    this.logger.log(`Processing agent access for path: ${path}, sessionKey: ${safeData.session.sessionKey}`);
    this.logger.log(body.description)

    

    const txHashes: string[] = [];

    for (const step of body.steps) {

        const call = {
            to: step.to,
            value: BigInt(step.value),
            data: step.data,
        }

        const txHash = await this.executeCall(call, safeData);

        txHashes.push(txHash);

    }
    
  }
} 