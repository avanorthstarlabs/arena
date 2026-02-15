// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract NorthToken is ERC20 {
    constructor(address distributor) ERC20("Northstar", "NORTH") {
        _mint(distributor, 100_000_000_000 * 10**decimals());
    }
}
