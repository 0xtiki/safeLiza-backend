import { Logger } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, http, extractChain, Chain, Hex } from 'viem';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address } from 'viem/account-abstraction';
import { getChainSlug } from '../utils/pimlico.js';
import * as chains from 'viem/chains';
import { sepolia } from 'viem/chains';
import { createSmartAccountClient, SmartAccountClient } from 'permissionless';
import { privateKeyToAccount } from 'viem/accounts';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { getAccount, MOCK_ATTESTER_ADDRESS, RHINESTONE_ATTESTER_ADDRESS } from '@rhinestone/module-sdk';
import { erc7579Actions } from 'permissionless/actions/erc7579';
import { getUnspendableAddress } from '../utils/smartAccount.js';

@Injectable()
export class RpcService {
  private readonly logger = new Logger(RpcService.name);

  private publicClients: Map<number, ReturnType<typeof createPublicClient>> = new Map();
  private pimlicoClients: Map<number, ReturnType<typeof createPimlicoClient>> = new Map();

  constructor(private configService: ConfigService) {}

  getPublicClient(chainId: number) {
    this.logger.log(`Getting public client for chain ID: ${chainId}`);

    if (this.publicClients.has(chainId)) {
      this.logger.log(`Public client found in cache for chain ID: ${chainId}`);
      return this.publicClients.get(chainId)!;
    }

    const chain = this.getChain(chainId);
    const rpcUrl = this.getRpcUrl(chainId);

    this.logger.log(`Creating new public client for chain ID: ${chainId} with RPC URL: ${rpcUrl}`);
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    this.publicClients.set(chainId, publicClient);

    return publicClient;
  }

  getPimlicoClient(chainId: number) {
    this.logger.log(`Getting Pimlico client for chain ID: ${chainId}`);

    if (this.pimlicoClients.has(chainId)) {
      this.logger.log(`Pimlico client found in cache for chain ID: ${chainId}`);
      return this.pimlicoClients.get(chainId)!;
    }

    const apiKey = this.configService.get('PIMLICO_API_KEY');
    if (!apiKey) throw new Error('Missing PIMLICO_API_KEY');

    const chainSlug = getChainSlug(chainId);
    if (!chainSlug) throw new Error('Unsupported chain');

    const pimlicoUrl = `${this.configService.get('PIMLICO_URL')}/${chainSlug}/rpc?apikey=${apiKey}`;

    this.logger.log(`Creating new Pimlico client for chain ID: ${chainId} with URL: ${pimlicoUrl}`);
    const pimlicoClient = createPimlicoClient({
      transport: http(pimlicoUrl),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    this.pimlicoClients.set(chainId, pimlicoClient);

    return pimlicoClient;
  }

  async getSmartAccountClient(chainId: number, safeAddress: Hex) {

    const pk = this.configService.get('PRIVATE_KEY') as Hex;

    const creatorAccount =privateKeyToAccount(pk);

    const safeAccount = await toSafeSmartAccount({
      client: this.getPublicClient(chainId),
      owners: [creatorAccount],
      version: '1.4.1',
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
      safe4337ModuleAddress: this.configService.get('SAFE_4337_MODULE_ADDRESS') as Hex,
      erc7579LaunchpadAddress: this.configService.get('ERC7579_LAUNCHPAD_ADDRESS') as Hex,
      attesters: [
        RHINESTONE_ATTESTER_ADDRESS, // Rhinestone Attester
        MOCK_ATTESTER_ADDRESS, // Mock Attester - do not use in production
      ],
      attestersThreshold: 1,
      address: safeAddress
    })

    // const safeAccount = getAccount({
    //   address: safeAddress,
    //   type: "safe",
    // })

    const pimlicoClient = this.getPimlicoClient(chainId);

    const smartAccountClient = createSmartAccountClient({
      account: safeAccount,
      chain: this.getChain(chainId),
      bundlerTransport: http(this.getPimlicoUrl(chainId)),
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          return (await pimlicoClient.getUserOperationGasPrice()).fast
        },
      },
    }).extend(erc7579Actions())

    return smartAccountClient;
  }

  async createSmartAccountClient(createClientData: {
    chainId: number, 
    privateKey?: Hex, 
    saltNonce?: bigint
  }) {
    this.logger.log(`Creating smart account client for chain ID: ${createClientData.chainId}`);

    // const privateKey = generatePrivateKey();

    const pk = createClientData.privateKey || this.configService.get('PRIVATE_KEY') as Hex;

    const creatorAccount =privateKeyToAccount(pk);

    this.logger.warn(`Creator account: ${creatorAccount.address}`);

    // this.logger.warn(`Private key: ${pk}`);

    // const privateKey = this.configService.get('PRIVATE_KEY');

    this.logger.log('Creating safe smart account');
    const safeAccount = await toSafeSmartAccount({
        client: this.getPublicClient(createClientData.chainId),
        owners: [creatorAccount],
        version: '1.4.1',
        entryPoint: {
          address: entryPoint07Address,
          version: '0.7',
        },
        safe4337ModuleAddress: this.configService.get('SAFE_4337_MODULE_ADDRESS') as Hex,
        erc7579LaunchpadAddress: this.configService.get('ERC7579_LAUNCHPAD_ADDRESS') as Hex,
        attesters: [
          RHINESTONE_ATTESTER_ADDRESS, // Rhinestone Attester
          MOCK_ATTESTER_ADDRESS, // Mock Attester - do not use in production
        ],
        attestersThreshold: 1,
        saltNonce: createClientData.saltNonce || BigInt(0),
    })

    const pimlicoClient = this.getPimlicoClient(createClientData.chainId);
    const pimlicoUrl = this.getPimlicoUrl(createClientData.chainId);

    this.logger.log('Creating smart account client');
    const smartAccountClient = createSmartAccountClient({
      account: safeAccount,
      chain: this.getChain(createClientData.chainId),
      bundlerTransport: http(pimlicoUrl),
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          return (await pimlicoClient.getUserOperationGasPrice()).fast;
        },
      },
    }).extend(erc7579Actions());

    return {smartAccountClient, privateKey: pk};
  }

  private getChain(chainId: number): Chain {
    this.logger.log(`Getting chain for chain ID: ${chainId}`);

    let chain = extractChain({
      chains: Object.values(chains) as Chain[],
      id: chainId,
    });

    if (!chain) {
      this.logger.log(`Chain not found for chain ID: ${chainId}, using Sepolia as default`);
      chain = sepolia;
    }

    return chain;
  }

  getRpcUrl(chainId: number): string {
    this.logger.log(`Getting RPC URL for chain: ${chainId}`);

    let rpcUrl = this.configService.get(`RPC_URL_${chainId}`);

    if (!rpcUrl) {
      this.logger.log(`RPC URL not found for chain: ${chainId}, using default Sepolia RPC URL`);
      rpcUrl = 'https://rpc.ankr.com/eth_sepolia';
    }

    return rpcUrl;
  }

  private getPimlicoUrl(chainId: number): string {
    this.logger.log(`Getting Pimlico URL for chain ID: ${chainId}`);

    const apiKey = this.configService.get('PIMLICO_API_KEY');
    if (!apiKey) throw new Error('Missing PIMLICO_API_KEY');

    const chainSlug = getChainSlug(chainId);
    if (!chainSlug) throw new Error('Unsupported chain');

    return `${this.configService.get('PIMLICO_URL')}/${chainSlug}/rpc?apikey=${apiKey}`;
  }
} 