export function getChainSlug(chainId: number): string | undefined {
  switch (chainId) {
    case 1:
      return 'mainnet';
    case 84532:
      return 'base-sepolia';
    case 10:
      return 'optimism';
    case 11155111:
      return 'sepolia';
    case 420:
      return 'optimism-sepolia';
    default:
      return undefined;
  }
} 