# Experiment

This directory contains the results of the experiment in our paper. Specifically, it contains the following directories:

- `./RQ1` contains the experiment results used in RQ1. It includes the augmentation results for smart contracts in Dataset 1. The augmented test cases for each contract in the dataset are stored in the `./RQ1/Result/augmented_test_cases` folder.
- `./RQ2` contains the experiment results used in RQ2. It includes the augmentation and migration results for smart contracts in Dataset 2. The augmented test cases for each contract in the dataset are stored in `./Result/augmented_test_cases/`. The migrated test cases are stored in `./Result/migrated_test_cases/`, with subfolders named as 'source contract' + '_' + 'target contract' . The manual label results of the migration results, including TPs, TNs, FPs, FNs, are stored in `./RQ2/ERC20_result.csv` and `./RQ2/ERC721_result.csv` respectively.
- `./RQ3` contains the experiment results used in RQ3. `./RQ3/ERC20_result.csv`and `./RQ3/ERC721_result.csv` include the comparison results between the migrated test cases in RQ2 and the real-world transactions of these contracts in Dataset 2.



### Reproduce the Experiment Results

The following commands can be used to reproduce the experiment results in our paper.

Specifically, to reproduce results used in RQ1, run the following command:

```bash
cd ./Code/Src
python3 main.py augment --contract_folder ../../Experiment/RQ1/ --augmentation_folder ../../Experiment/RQ1/ --etherscan_api ETHERSCAN_API_KEY --http_provider GETH_ARCHIVE_PROVIDER
```

To reproduce results used in RQ2 and RQ3, run the following command:

```bash
cd ./Code/Src
python3 main.py augment --contract_folder ../../Experiment/RQ2/Top_ERC20/ --augmentation_folder ../../Experiment/RQ2/Top_ERC20/ --etherscan_api ETHERSCAN_API_KEY --http_provider GETH_ARCHIVE_PROVIDER
python3 main.py migrate --contract_folder ../../Experiment/RQ2/Top_ERC20/ --augmentation_folder ../../Experiment/RQ2/Top_ERC20/ --migration_folder ../../Experiment/RQ2/Top_ERC20/ --etherscan_api ETHERSCAN_API_KEY --http_provider GETH_ARCHIVE_PROVIDER
```

```bash
cd ./Code/Src
python3 main.py augment --contract_folder ../../Experiment/RQ2/Top_ERC721/ --augmentation_folder ../../Experiment/RQ2/Top_ERC721/ --etherscan_api ETHERSCAN_API_KEY --http_provider GETH_ARCHIVE_PROVIDER
python3 main.py migrate --contract_folder ../../Experiment/RQ2/Top_ERC721/ --augmentation_folder ../../Experiment/RQ2/Top_ERC721/ --migration_folder ../../Experiment/RQ2/Top_ERC20/ --etherscan_api ETHERSCAN_API_KEY --http_provider GETH_ARCHIVE_PROVIDER
```

For more details about how to run SolMigrator, please refer to `Code/README.md`.