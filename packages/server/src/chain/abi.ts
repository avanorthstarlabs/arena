import { parseAbi } from "viem";

/**
 * Minimal ERC-20 ABI for Transfer events and transfer/balanceOf calls
 */
export const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
