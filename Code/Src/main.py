from test_case_augment import execute_test_cases_in_folder_and_record_trace, test_replayer_and_recorder
from migrate_testcase import migrate
from excute_migrated_test_cases import execute_migrated_test_cases_with_assertions
from pack_test_cases import pack_test_cases_to_folder
import os
import itertools
from compile_contract import compile_and_analyze_contract
import argparse
import os
import json
from slither import Slither


def main():
    parser = argparse.ArgumentParser(description="SolMigrator")
    subparsers = parser.add_subparsers(dest='mode', help='Choose the operation (augment or migrate)')
    augment_parser = subparsers.add_parser('augment', help='Augment mode')
    augment_parser.add_argument('--contract_folder', type=str, required=True, help='Path to the folder containing contract information')
    augment_parser.add_argument('--contract', type=str, default='', help='Specific contract to augment test cases for (if not specified, test cases will be augmented for all contracts in the input folder)')
    augment_parser.add_argument('--augmentation_folder', type=str, required=True, help='Path to the folder where augmented test cases will be stored')
    augment_parser.add_argument('--max_transactions', type=int, default=1000, help='Maximum number of transactions to process')
    augment_parser.add_argument('--etherscan_api', type=str, required=True, help='Etherscan API key for querying historical transactions')
    augment_parser.add_argument('--http_provider', type=str, required=True, help='HTTP provider URL for Geth Archive Node (JSON-RPC API) to replay transactions')
    augment_parser.add_argument('--folding_timeout', type=str, default=1000, help='Timeout duration for folding process')

    migrate_parser = subparsers.add_parser('migrate', help='Migrate mode')
    migrate_parser.add_argument('--contract_folder', type=str, required=True, help='Path to the folder containing contract information')
    migrate_parser.add_argument('--source', type=str, default='', help='Source contract for migration (if not specified, migration will be performed among all pairs of contracts in the input folder)')
    migrate_parser.add_argument('--target', type=str, default='', help='Target contract for migration')
    migrate_parser.add_argument('--augmentation_folder', type=str, required=True, help='Path to the folder containing augmentation results')
    migrate_parser.add_argument('--migration_folder', type=str, required=True, help='Path to the folder where migrated test cases will be stored')
    migrate_parser.add_argument('--etherscan_api', type=str, required=True, help='Etherscan API key for querying historical transactions')
    migrate_parser.add_argument('--http_provider', type=str, required=True, help='HTTP provider URL for Geth Archive Node (JSON-RPC API)')

    args = parser.parse_args()
    if args.mode == 'augment':
        augment_cmd(args)
    elif args.mode == 'migrate':
        migrate_cmd(args)
    else:
        parser.print_help()


def augment_cmd(args):
    if not os.path.exists(args.augmentation_folder):
        os.makedirs(args.augmentation_folder, exist_ok=True)
    if not os.path.exists(os.path.join(args.augmentation_folder, "augmented_test_case")):
        print("Making new dir to store augmented test cases:", os.path.join(args.augmentation_folder, "augmented_test_case"))
        os.makedirs(os.path.join(args.augmentation_folder, "augmented_test_case"))
    
    contract_files = []
    for f in os.listdir(os.path.join(args.contract_folder,"Contract_Info/")):
        with open(os.path.join(args.contract_folder,"Contract_Info/", f), "r") as fr:
            contract = json.loads(fr.read())
            contract['file'] = os.path.join(args.contract_folder, contract['file'])
            contract_files.append(contract)
    if args.contract != '':
        contract_files = [x for x in contract_files if x['id'] == args.contract]
    for contract in contract_files:
        try:
            test_replayer_and_recorder(contract, args)
        except Exception as e:
            print("Failed augmentation due to", e)
            continue
    return

def migrate_cmd(args):
    contract_files = []
    for f in os.listdir(os.path.join(args.contract_folder,"Contract_Info/")):
        with open(os.path.join(args.contract_folder,"Contract_Info/", f), "r") as fr:
            contract = json.loads(fr.read())
            contract['file'] = os.path.join(args.contract_folder, contract['file'])
            contract_files.append(contract)
    if args.source != '':
        source = [x for x in contract_files if x['id'] == args.source][0]
        target = [x for x in contract_files if x['id'] == args.target][0]
        permutations = [(source, target)]
    else:
        permutations = list(itertools.permutations(contract_files, 2))
    for (source_contract, target_contract) in permutations:
            taskid = source_contract['id'] + '_' + target_contract['id']
            try:
                migrated_test_cases = migrate(source_contract, target_contract, args)
                migrated_folder = os.path.join(args.migration_folder, 'migrated_test_case',  source_contract['id'] + '_' + target_contract['id']) 
                pack_test_cases_to_folder(migrated_folder, migrated_test_cases)
            except Exception as e:
                print(e)
                continue
    return

if __name__ == "__main__":
    main()

