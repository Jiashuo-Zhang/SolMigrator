# Cases for Bug-Finding

### The Case of BNB 

```solidity
// The source code of the BNB smart contract (0xB8c77482e45F1F44dE1745F52C74426C631bDD52)
/* 
    Allow another contract to spend some tokens on your behalf 
*/
function approve(address _spender, uint256 _value)
    returns (bool success) {
    if (_value <= 0) throw; 
    allowance[msg.sender][_spender] = _value; // Does not emit an Approval event
    return true;
}
```

As shown in the above figure, the BNB contract in our benchmark contract set does not emit the `Approval` event in the implementation of the `approve` function. However, the `Approval` event is a "MUST" requirement in the ERC-20 Specification (https://eips.ethereum.org/EIPS/eip-20). This non-compliance with the ERC-20 specification by the BNB implementation may lead to unexpected behavior when interacting with the BNB contract using off-chain programs or browser wallet plugins. It is considered a vulnerability according to the common ERC20 vulnerability classification list (https://github.com/sec-bit/awesome-buggy-erc20-tokens/blob/master/ERC20_token_issue_list.md#b7-no-approval).

```solidity
// Example implementation of ERC-20 compatible smart contracts 

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
	event Approval(address indexed owner, address indexed spender, uint256 value);

   function approve(address spender, uint256 amount) public virtual override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }
    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(address owner, address spender, uint256 amount) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount); // Emit an Approval Event
    }
```

During SolMigrator's test case migration process, the test cases migrated from existing ERC-20 compatible source contracts will check if the Approval event is emitted during execution. Therefore, these test cases will fail on the BNB contract. Developers can further investigate the cause of these failures and determine whether the BNB contract needs to emit the Approval Event in the `approve` function.



### The Case of PepeToken

```solidity
// The source code of the PepeToken smart contract (0x6982508145454Ce325dDbE47a25d4ec3d2311933)
/**
 * @dev See {IERC20-transfer}.
 *
 * Requirements:
 *
 * - `recipient` cannot be the zero address.
 * - the caller must have a balance of at least `amount`.
 */
function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    _transfer(_msgSender(), recipient, amount);
    return true;
}

function setRule(bool _limited, address _uniswapV2Pair, uint256 _maxHoldingAmount, uint256 _minHoldingAmount) external onlyOwner {
    limited = _limited;
    uniswapV2Pair = _uniswapV2Pair;
    maxHoldingAmount = _maxHoldingAmount;
    minHoldingAmount = _minHoldingAmount;
}
/**
 * @dev Moves `amount` of tokens from `sender` to `recipient`.
 *
 * This internal function is equivalent to {transfer}, and can be used to
 * e.g. implement automatic token fees, slashing mechanisms, etc.
 *
 * Emits a {Transfer} event.
 *
 * Requirements:
 *
 * - `sender` cannot be the zero address.
 * - `recipient` cannot be the zero address.
 * - `sender` must have a balance of at least `amount`.
 */
function _transfer(
    address sender,
    address recipient,
    uint256 amount
) internal virtual {
    require(sender != address(0), "ERC20: transfer from the zero address");
    require(recipient != address(0), "ERC20: transfer to the zero address");

    _beforeTokenTransfer(sender, recipient, amount);

    uint256 senderBalance = _balances[sender];
    require(senderBalance >= amount, "ERC20: transfer amount exceeds balance");
    unchecked {
        _balances[sender] = senderBalance - amount;
    }
    _balances[recipient] += amount;

    emit Transfer(sender, recipient, amount);

    _afterTokenTransfer(sender, recipient, amount);
}

function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
) override internal virtual {
    require(!blacklists[to] && !blacklists[from], "Blacklisted");

    if (uniswapV2Pair == address(0)) {
        require(from == owner() || to == owner(), "trading is not started");
        return;
    }

    if (limited && from == uniswapV2Pair) {
        require(super.balanceOf(to) + amount <= maxHoldingAmount && super.balanceOf(to) + amount >= minHoldingAmount, "Forbid");
    }
}
```

As shown in the above figure, the PepeToken smart contract in our benchmark set disable token transfers by default, and the contract owner can enable or disable them at any time. After the smart contract is deployed, the contract owner needs to call the `setRule` function to enable transfers. When a user attempts to transfer their tokens by calling the `transfer` function,  the `transfer` function will call the `_beforeTokenTransfer` function to check if transfers have been enabled by the owner: if not, the transfer operation will be reverted. Additionally, during the operation of the contract, the contract owner can enable/disable transfers at any time by calling the `setRules` function. 

However, a recent study (*CRPWarner: Warning the Risk of Contract-related Rug Pull in DeFi Smart Contracts*, TSE'24) indicates that the implementation that allows the owner to enable and disable token transfers between users at any time, may lead to the risk of contract-related rug pulls. They refer to this defect as a *Limiting Sell Order*. Because if transfers between users are unintentionally or maliciously disabled, users will be unable to sell their tokens, leading to financial losses directly.

In other ERC20 contracts, there is no additional requirement to enable transfers, so they generate test cases that attempt to transfer tokens directly without any additional operations. During SolMigrator's migration process, direct transfer operations will be reverted by the PepeToken contract, causing these test cases to fail on the PepeToken contract. Developers can further analyze these failures to determine whether the implementation that allows the owner to arbitrarily disable or enable transfers is a bug or an intentional design choice.















