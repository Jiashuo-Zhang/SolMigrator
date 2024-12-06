from slither import Slither
from match_test import exact_match_test_case, partial_match_test_case
from generate_assertion import extract_recorded_test_cases
from compile_contract import compile_and_analyze_contract
from match_function import deep_match_function, migrate_payable_function, migrate_creation_bytecode, get_function_selectors, migrate_assertions
import os
import json
from test_case_augment import execute_transactions, save_test_cases, execute_test_cases_in_folder_and_record_trace




def migrate(source_contract, target_contract, args):
    try:
        _, target_slither_instances = compile_and_analyze_contract(target_contract['address'], target_contract['file'], args.etherscan_api, target_contract['Compiler Version'])
    except Exception as e:
        print("Fail To Compile", target_contract['id'], e)
        return []
    _, source_slither_instances = compile_and_analyze_contract(source_contract['address'], source_contract['file'], args.etherscan_api, source_contract['Compiler Version'])
    
    source_test_cases = extract_recorded_test_cases(source_contract, get_function_selectors(source_slither_instances), args)

    source_contract_instance = source_slither_instances.get_contract_from_name(source_contract['name'])[0]
    target_contract_instance = target_slither_instances.get_contract_from_name(target_contract['name'])[0]
    
    source_func_to_target = deep_match_function(source_contract_instance, target_contract_instance)

    print(f"Loaded {len(source_test_cases)} source test cases from {source_contract['id']}, trying to migrate them to {target_contract['id']}")
    matched_test_cases = exact_match_test_case(source_test_cases,  get_function_selectors(source_slither_instances), get_function_selectors(target_slither_instances), source_func_to_target)

    
    partially_matched_test_cases, _, _, _ = partial_match_test_case(source_test_cases,  get_function_selectors(source_slither_instances), get_function_selectors(target_slither_instances), source_func_to_target)
    for p in partially_matched_test_cases:
        if p not in matched_test_cases:
            matched_test_cases[p] = partially_matched_test_cases[p]
    
    migrated_test_cases = migrate_creation_bytecode(matched_test_cases, target_contract['creation_bytecode'], source_contract['creation_bytecode'], source_contract_instance, target_contract_instance, source_func_to_target)
    
    migrated_test_cases = migrate_payable_function(matched_test_cases, target_contract_instance)
    
    success_executed_test_cases = {}
    for i in migrated_test_cases.keys():
        tx_chain = migrated_test_cases[i]['transactions']
        execution_result = execute_transactions(tx_chain)
        valid = False
        if (tx_chain[-1]['hash'] in execution_result and ('receipt' in execution_result[tx_chain[-1]['hash']]) and (execution_result[tx_chain[-1]['hash']]['receipt']['status'] == 1 and tx_chain[-1]['isError']=='0')) or ('receipt' in execution_result[tx_chain[-1]['hash']] and execution_result[tx_chain[-1]['hash']]['receipt']['status'] == 0 and tx_chain[-1]['isError']=='1'): 
            valid = True
            success_executed_test_cases[i] = migrated_test_cases[i]
        if valid:
            print("Successfully migrated test case",i)
            

    
    print(f'from {source_contract["id"]} to {target_contract["id"]}, All Test Case: {len(source_test_cases)}, Successfully Migrate: {len(success_executed_test_cases)}')
    
    success_executed_test_cases, _, _ = migrate_assertions(success_executed_test_cases, source_contract_instance, target_contract_instance, source_func_to_target)
        
    test_case_folder = os.path.join(args.migration_folder, 'migrated_test_case', source_contract['id']+'_'+target_contract['id'])
    recorded_test_txns = {}
    for i in success_executed_test_cases:
        recorded_test_txns[i] = success_executed_test_cases[i]['transactions']
    save_test_cases(test_case_folder, recorded_test_txns)
    execute_test_cases_in_folder_and_record_trace(test_case_folder)

    
    return success_executed_test_cases 
