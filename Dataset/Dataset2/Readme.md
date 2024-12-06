## Dataset 2

Dataset 2 contains real-world smart contracts within the two most popular categories, namely, ERC20 and ERC721. It includes the top ten contracts for ERC20 and ERC721 smart contracts respectively. They are collected from Etherscan's [Top Token List](https://etherscan.io/tokens) and [Top NFT list](https://etherscan.io/nft-top-contracts).

This directory includes two sub-categories, specifically Top-ERC20 contracts and Top-ERC721 Contracts.

Specifically, each sub-directory includes the following contents:

- `./contract_list.txt`. This file contains a list of all contracts in Dataset 2. Each line includes one contract, featuring the contract’s name and its on-chain address, for example: BNB_0xB8c77482e45F1F44dE1745F52C74426C631bDD52.
- `./Contract_Info/`. This folder contains information related to the contracts in Dataset 2, such as the compilation version number, creation bytecode, ABI, etc. This information is collected from Etherscan.
- `./Contract_Source_Code/`. This folder contains the source code for the contracts in Dataset 2. It is collected from Etherscan.
- `./Tx_History/`. This folder contains the transaction history for each contract, including external transactions and internal transactions.