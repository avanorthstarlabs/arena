// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ArenaToken is ERC20 {
    constructor(address distributor) ERC20("Arena Token", "ARENA") {
        _mint(distributor, 100_000_000_000 * 10**decimals());
    }
}
