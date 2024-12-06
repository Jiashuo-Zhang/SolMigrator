## Dataset 1

Dataset 1 contains real-world smart contracts within the two most popular categories, namely, ERC20 and ERC721. It is collected from the `crypto_ethereum` database maintained by [Google Bigquery](https://cloud.google.com/bigquery). It includes 93 ERC20 smart contracts and 51 ERC721 smart contracts, which were used in the Evaluation RQ1 Section.

Specifically, this directory includes the following contents:

- `./contract_list.txt`. This file contains a list of all contracts in Dataset 1. Each line includes one contract, featuring the contract’s name and its on-chain address, for example: BNB_0xB8c77482e45F1F44dE1745F52C74426C631bDD52.
- `./Contract_Info/`. This folder contains information related to the contracts in Dataset 1, such as the compilation version number, creation bytecode, ABI, etc. This information is collected from Etherscan.
- `./Contract_Source_Code/`. This folder contains the source code for the contracts in Dataset 1. It is collected from Etherscan.
- `./Tx_History/`. This folder contains the transaction history for each contract, including external transactions and internal transactions.