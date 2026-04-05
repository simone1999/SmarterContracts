export const REGISTRY_ABI = [
  {
    name: "getRegisteredContractCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getRegisteredContract",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getRegistration",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "contractAddress", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "active", type: "bool" },
          { name: "admin", type: "address" },
          { name: "balance", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "checkUpkeep",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "contractAddress", type: "address" }],
    outputs: [
      { name: "upkeepNeeded", type: "bool" },
      { name: "performData", type: "bytes" },
    ],
  },
  {
    name: "triggerUpkeep",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "contractAddress", type: "address" },
      { name: "performData", type: "bytes" },
      { name: "minPayment", type: "uint256" },
    ],
    outputs: [{ name: "payment", type: "uint256" }],
  },
  {
    name: "fund",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "contractAddress", type: "address" }],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "contractAddress", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "cancelRegistration",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "contractAddress", type: "address" }],
    outputs: [],
  },
  {
    name: "UpkeepTriggered",
    type: "event",
    inputs: [
      { name: "contractAddress", type: "address", indexed: true },
      { name: "solver", type: "address", indexed: true },
      { name: "payment", type: "uint256", indexed: false },
    ],
  },
  {
    name: "ContractRegistered",
    type: "event",
    inputs: [
      { name: "contractAddress", type: "address", indexed: true },
      { name: "admin", type: "address", indexed: true },
      { name: "initialBalance", type: "uint256", indexed: false },
    ],
  },
  {
    name: "BalanceFunded",
    type: "event",
    inputs: [
      { name: "contractAddress", type: "address", indexed: true },
      { name: "funder", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newBalance", type: "uint256", indexed: false },
    ],
  },
] as const;
