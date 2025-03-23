import { SafeSigner } from "@safe-global/protocol-kit";
import { Address, Hex } from "viem";

export interface SafeOwnerConfig {
    safeAddress: string;
    ownerAddressToAddOrRemove: string;
    chainId: number;
    threshold?: number;
    signer?: SafeSigner;
} 

export type Policy = {
    policy: Address
    address: Address
    initData: Hex
  }
  

export type policyParams = SpendingLimits | ValueLimit | TimeFrame | UniversalAction | Sudo

type Sudo = {
    policy: 'sudo'
    params: null
  }

type SpendingLimits = {
  policy: 'spendingLimits'
  params: ParamsSpendingLimits
}

type ParamsSpendingLimits = {
  token: Address
  limit: bigint
}[]

type ValueLimit = {
  policy: 'valueLimit'
  params: ParamsValueLimit
}

type ParamsValueLimit = {
  limit: bigint
}

type TimeFrame = {
  policy: 'timeFrame'
  params: ParamsTimeFrame
}

type ParamsTimeFrame = {
  validUntil: number
  validAfter: number
}

type UniversalAction = {
  policy: 'universalAction'
  params: ParamsUniversalAction
}

type ParamsUniversalAction = {
  policy: 'universalAction'
  actionPolicies: ActionConfig[]
}

enum ParamCondition {
  EQUAL = 0,
  GREATER_THAN = 1,
  LESS_THAN = 2,
  GREATER_THAN_OR_EQUAL = 3,
  LESS_THAN_OR_EQUAL = 4,
  NOT_EQUAL = 5,
  IN_RANGE = 6,
}

// LimitUsage struct
interface LimitUsage {
  limit: bigint // uint256 in Solidity
  used: bigint // uint256 in Solidity
}

// ParamRule struct
interface ParamRule {
  condition: ParamCondition
  offset: bigint
  isLimited: boolean
  ref: Hex
  usage: LimitUsage
}

// ParamRules struct with fixed length array
interface ParamRules {
  length: bigint
  rules: [
    ParamRule,
    ParamRule,
    ParamRule,
    ParamRule,
    ParamRule,
    ParamRule,
    ParamRule,
    ParamRule,
    ParamRule,
    ParamRule,
    ParamRule,
    ParamRule,
    ParamRule,
    ParamRule,
    ParamRule,
    ParamRule,
  ] // ParamRule[16] in Solidity
}

// ActionConfig struct
interface ActionConfig {
  valueLimitPerUse: bigint // uint256 in Solidity
  paramRules: ParamRules
}