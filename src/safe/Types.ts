import { SafeSigner } from "@safe-global/protocol-kit";

export interface SafeOwnerConfig {
    safeAddress: string;
    ownerAddressToAddOrRemove: string;
    chainId: number;
    threshold?: number;
    signer?: SafeSigner;
} 