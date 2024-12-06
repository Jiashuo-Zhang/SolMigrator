## SolMigrator

## Description

This directory contains SolMigrator's source code, a migration-based tool to generate expressive and function-relevant test cases for Ethereum smart contracts.

## Installation

**Environment: SolMigrator is tested on Python 3.10.0, and Windows WSL**

**Installation steps for SolMigrator:**

```bash
cd ./Src
pip3 install -r requirements.txt
cd ./Src/Hardhat
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox 
```

## Usage

For basic usage information, execute the help command below:

```bash
python3 main.py --help
```

Specifically, SolMigrator supports two functionalities: augment and migrate. They are used to augment test cases from on-chain contracts and migrate test cases between contracts, respectively.

```bash
usage: main.py [-h] {augment,migrate} ...

SolMigrator

positional arguments:
  {augment,migrate}  Choose the operation (augment or migrate)
    augment          Augment mode
    migrate          Migrate mode

options:
  -h, --help         Show this help message and exit
```



### Test Case Augmentation

#### Usage of the augment command

You can view the usage of the augment command with the following command:

```bash
python3 main.py augment --help
usage: main.py augment [-h] --contract_folder CONTRACT_FOLDER [--contract CONTRACT] --augmentation_folder AUGMENTATION_FOLDER [--max_transactions MAX_TRANSACTIONS] [--etherscan_api ETHERSCAN_API] [--http_provider HTTP_PROVIDER] [--folding_timeout FOLDING_TIMEOUT]

options:
  -h, --help            Show this help message and exit
  --contract_folder CONTRACT_FOLDER
                        Path to the folder containing contract information
  --contract CONTRACT   Specific contract to augment test cases for (if not specified, test cases will be augmented for all contracts in the input folder)
  --augmentation_folder AUGMENTATION_FOLDER
                        Path to the folder where augmented test cases will be stored
  --max_transactions MAX_TRANSACTIONS
                        Maximum number of transactions to process
  --etherscan_api ETHERSCAN_API
                        Etherscan API key for querying historical transactions
  --http_provider HTTP_PROVIDER
                        HTTP provider URL for Geth Archive Node (JSON-RPC API) to replay transactions
  --folding_timeout FOLDING_TIMEOUT
                        Timeout duration for folding process
```

**Example**

For example, users can run the following command to reproduce the results in Evaluation RQ1:

```bash
python3 main.py augment --contract_folder ../../Experiment/RQ1/ --augmentation_folder  ../../Experiment/RQ1/ --etherscan_api ETHERSCAN_API_KEY --http_provider GETH_ARCHIEVE_PROVIDER
```

This will augment test cases for 93 on-chain ERC20 contracts and 51 ERC721 contracts in Dataset1 and store them in the augmentation folder.

If users only want to augment for a specific contract, they can use the `--contract` option to specify the file name of the contract, as shown below:

```bash
python3 main.py augment --contract_folder ../../Experiment/RQ1/ --augmentation_folder  ../../Experiment/RQ1/ --contract Miladys_0x5Af0D9827E0c53E4799BB226655A1de152A425a5 --etherscan_api ETHERSCAN_API_KEY --http_provider GETH_ARCHIEVE_PROVIDER
```



### Test Case Migration

Once test case augmentation for the source contract is complete, SolMigrator is ready to migrate the augmented test cases to the target smart contracts.

#### Usage of the migrate command

You can view the usage of the migrate command with the following command:

```bash
python3 main.py migrate --help
usage: main.py migrate [-h] --contract_folder CONTRACT_FOLDER [--source SOURCE] [--target TARGET] --augmentation_folder AUGMENTATION_FOLDER --migration_folder MIGRATION_FOLDER [--etherscan_api ETHERSCAN_API] [--http_provider HTTP_PROVIDER]

options:
  -h, --help            Show this help message and exit
  --contract_folder CONTRACT_FOLDER
                        Path to the folder containing contract information
  --source SOURCE       Source contract for migration (if not specified, migration will be performed among all pairs of contracts in the input folder)
  --target TARGET       Target contract for migration
  --augmentation_folder AUGMENTATION_FOLDER
                        Path to the folder containing augmentation results
  --migration_folder MIGRATION_FOLDER
                        Path to the folder where migrated test cases will be stored
  --etherscan_api ETHERSCAN_API
                        Etherscan API key for querying historical transactions
  --http_provider HTTP_PROVIDER
                        HTTP provider URL for Geth Archive Node (JSON-RPC API)
```

**Example**

For example, users can run the following command to reproduce the results in Evaluation RQ2:

```bash
python3 main.py augment --contract_folder ../../Experiment/RQ2/Top_ERC20/ --augmentation_folder ../../Experiment/RQ2/Top_ERC20/ --etherscan_api ETHERSCAN_API_KEY --http_provider GETH_ARCHIEVE_PROVIDER
python3 main.py migrate --contract_folder ../../Experiment/RQ2/Top_ERC20/ --augmentation_folder ../../Experiment/RQ2/Top_ERC20/ --migration_folder ../../Experiment/RQ2/Top_ERC20/ --etherscan_api ETHERSCAN_API_KEY --http_provider GETH_ARCHIEVE_PROVIDER
```

If users only want to migrate test cases for a specific source-target pair, they can use the `--source` and `--target` options to specify the source contract and the target contract, as shown below:

```bash
python3 main.py migrate --contract_folder ../../Experiment/RQ2/Top_ERC20/ --augmentation_folder ../../Experiment/RQ2/Top_ERC20/ --migration_folder ../../Experiment/RQ2/Top_ERC20/ --source BNB_0xB8c77482e45F1F44dE1745F52C74426C631bDD52 --target FetchToken_0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85 --etherscan_api ETHERSCAN_API_KEY --http_provider GETH_ARCHIEVE_PROVIDER
```

Users can use the ```npx hardhat test`` command to run the migrated test cases using the hardhat testing framework. For example:

```bash
cd ./TestExecutor
npx install --save-dev
npx hardhat test ../../Experiment/RQ2/Top_ERC20/migrated_test_case/BNB_0xB8c77482e45F1F44dE1745F52C74426C631bDD52_FetchToken_0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85/0.test.js
```

