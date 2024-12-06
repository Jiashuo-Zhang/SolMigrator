# RQ2

This directory contains the results used in RQ2 in our paper.

It includes the augmentation and migration results for smart contracts in Dataset 2. 

* The augmented test cases for each contract in the dataset are stored in `./Result/augmented_test_cases/` in the Top_ERC20 or Top_ERC721 subfolder. 
* The migrated test cases are stored in `./Result/migrated_test_cases/` in the Top_ERC20 or Top_ERC721 subfolder, named as 'source contract' + '_' + 'target contract' . 
* The manual label results of the migration results, including TPs, TNs, FPs, FNs, are stored in `./RQ2/ERC20_result.csv` and `./RQ2/ERC721_result.csv` respectively.



### Reproduce the Experiment Results

To reproduce results used in RQ2, run the following command:

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