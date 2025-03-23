# Smart Agent Wallet Backend

<p align="center">
  <img src="safeLiza.webp" alt="Safe Liza" width="600" />
</p>

<p align="center">
  🚀 ✨ <b>Make sure to also check out the frontend repo here <Link></b> ✨ 🚀
</p>


## Overview

Welcome to the Smart Agent Wallet Backend! This project provides a robust and user-friendly backend service for creating and managing Gnosis Safe smart wallets with permissioned access for AI agents. 

The Smart Agent Wallet makes it easy to:
- Create secure Gnosis Safe wallets across multiple chains
- Configure fine-grained permissions for automated agents
- Enable AI assistants to execute transactions on your behalf
- Maintain control while delegating specific capabilities

## Purpose

Managing crypto assets can be complex and risky, especially when trying to automate transactions or integrate with AI agents. This backend solves these challenges by:

1. **Simplifying Smart Wallet Creation**: Easy setup of Gnosis Safe wallets with passkey authentication
2. **Enabling Permissioned Access**: Create secure sessions with specific limitations (spending limits, time frames, etc.)
3. **Easy Integration**: Simple to integrate via REST API (tool call)
4. **Reducing Risk**: Granular control over what actions agents can perform
5. **Improving User Experience**: Abstract away the complexity of blockchain interactions

## Key Features

### Safe Creation and Management
- Multi-chain support for deploying Gnosis Safe wallets
- Multiple authentication methods (passkeys, multisig)
- ERC-7579 module integration for enhanced functionality

### Session Management
- Create permissioned sessions for AI agents
- Configure policies like:
  - Spending limits
  - Value limits per transaction
  - Time-based restrictions
  - Action-specific permissions

### Agent Integration
- Secure endpoints for agent access
- Transaction execution with proper validation
- Support for complex multi-step operations

### Security
- Passkey authentication support
- Session-based access control
- Validator modules for transaction verification

## Technical Stack

- **Framework**: NestJS
- **Database**: MongoDB with Mongoose
- **Blockchain Interaction**: Viem, Permissionless, Safe Protocol Kit
- **Authentication**: Passport with FIDO2 WebAuthn
- **Module System**: Rhinestone Module SDK for Safe extensions

## Getting Started

### Prerequisites
- Node.js
- MongoDB
- API keys for RPC providers and Pimlico

### Installation

```bash
# Clone the repository
git clone https://github.com/0xtiki/smart-agent-wallet-backend.git

# Install dependencies
cd smart-agent-wallet-backend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the server
npm run start:dev
```

### Configuration

The backend requires several environment variables:
- `PORT`: Port to run the server on
- `MONGODB_URI`: MongoDB connection string
- `NODE_ENV`: Environment (development, production)
- `RPC_URL_*`: RPC endpoints for different chains (e.g. RPC_URL_1, RPC_URL_42161, etc.)
- `PIMLICO_API_KEY`: For gas sponsorship
- `PIMLICO_URL`: https://api.pimlico.io/v2
- `PRIVATE_KEY`: For initial Safe deployment
- `ETHERSCAN_API_KEY`: For data fetching
- `SAFE_4337_MODULE_ADDRESS`: 0x7579EE8307284F293B1927136486880611F20002
- `ERC7579_LAUNCHPAD_ADDRESS`: 0x7579011aB74c46090561ea277Ba79D510c6C00ff

## Usage Flow

1. **Create a Safe**: Deploy a new Safe with passkey or multisig authentication
2. **Install Modules**: Set up validator modules for different authentication methods
3. **Configure Sessions**: Create permissioned sessions for agents with specific policies
4. **Activate Endpoints**: Enable secure endpoints for agent access
5. **Agent Execution**: Agents can now execute transactions within their permissions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Acknowledgments

- [Safe Global](https://safe.global/) for their smart contract wallet infrastructure
- [Rhinestone](https://rhinestone.wtf/) for their module SDK
- [Pimlico](https://pimlico.io/) for gas sponsorship capabilities

---

Happy and secure agent automation! 🤖💼🔒
