import copy
import itertools
import os
import json
import requests
from web3 import Web3
from collections import Counter
import subprocess
import tempfile
import time

def save_test_cases(test_case_folder, test_cases):
    if not os.path.exists(test_case_folder):
        os.makedirs(test_case_folder)
    for testcase in test_cases:
        with open(os.path.join(test_case_folder, str(testcase)+'.json'), 'w+') as f:
            json.dump(test_cases[testcase], f, indent=4)
    return

def execute_transactions(transactions, should_record_trace = []):

    with tempfile.TemporaryDirectory(dir="./Hardhat") as temp_dir:
        test_case_path = os.path.join(temp_dir, 'test_cases.json')
        with open(test_case_path, 'w') as f:
            json.dump(transactions, f)
        should_record_trace = list(should_record_trace)
        should_record_trace = ['"' + x + '"' for x in should_record_trace]
        js_should_record_trace = F"{','.join(should_record_trace)}"
        
        script_path = os.path.join(temp_dir, 'execute_transactions.js')
        with open(script_path, 'w') as script_file:
            script_file.write(f"""
                const {{ ethers }} = require("hardhat");
                const {{ mine }} = require('@nomicfoundation/hardhat-network-helpers');
                const fs = require("fs");
                const should_include_trace = [{js_should_record_trace}];
                async function executeTransaction(tx) {{               
                    await ethers.provider.send("hardhat_impersonateAccount", [tx.from]);
                    await ethers.provider.send("hardhat_setBalance", [tx.from, "0x3635C9ADC5DEA000000000000000"]);   
                    const signer = await ethers.getSigner(tx.from);
                    let gas = Number(tx.gas)
                    gas = 100000000
                    const currentBlockNumber = await ethers.provider.getBlockNumber();
                    const targetBlockNumber = parseInt(tx.blockNumber, 10);  
                    if (targetBlockNumber && targetBlockNumber > currentBlockNumber) {{
                        const blocksToMine = targetBlockNumber - currentBlockNumber -1;
                        await mine(blocksToMine);
                    }}
                    if (tx.timestamp) {{
                        const timestamp = parseInt(tx.timestamp, 10);  
                        await setNextBlockTimestamp(timestamp);
                    }}
                    
                    let transactionValue;
                    if (tx.value == "0") {{
                        transactionValue = "0";
                    }} else {{
                        const tenEthInWei = ethers.utils.parseUnits("10", "ether"); 
                        const valueInWei = ethers.BigNumber.from(tx.value); 
                        transactionValue = valueInWei.add(tenEthInWei).toString();  
                    }}

                    const transaction = {{
                        to: tx.to || undefined,
                        value: transactionValue,
                        gasLimit: ethers.utils.hexlify(gas),
                        gasPrice: ethers.utils.hexlify(20000000000),
                        data: tx.input
                    }};
                    let txResponse;
                    let txReceipt;
                    let txHash;

                    try {{                        
                        txResponse = await signer.sendTransaction(transaction);       
                        txReceipt = await txResponse.wait();  
                        txHash = txReceipt.transactionHash;
                    }} catch (error) {{               
                        if (error.transactionHash) {{                         
                            txHash = error.transactionHash;                         
                            txReceipt = await ethers.provider.getTransactionReceipt(txHash);
                        }}
                    }}             
                    return {{ hash: txHash, receipt: txReceipt}};
                }}                
                async function main() {{
                const testCasesPath = './test_cases.json';
                const testResultPath = './result.json';
                const testCases = require(testCasesPath);
                let results = {{}};         
                let contractAddr;

                for (let i = 0; i < testCases.length; i++) {{
                    const tx = testCases[i];           
                    if (i === 0) {{
                        const deployResult = await executeTransaction(tx);
                        contractAddr = deployResult.receipt.contractAddress;
                        results = {{
                            receipt: deployResult.receipt,
                            hash: deployResult.hash,
                        }};
                    }} else {{
                        
                        tx.to = contractAddr;
                        const result = await executeTransaction(tx);
                        
                        results = {{
                            receipt: result.receipt,
                            hash: result.hash
                        }};
                    }}
                    if (should_include_trace.includes(tx.hash)){{
                        let trace = {{}}
                        try {{ trace = results.hash ? await ethers.provider.send("debug_traceTransaction", [
                        results.hash, {{ disableStack: true, disableStorage: true}} ]) : null; 
                        }} catch (error) {{                  
                            trace = {{}};
                        }}
                        results['trace'] = trace
                    }}
                        try{{
                            fs.writeFileSync(`./${{tx.hash}}_result.json`, JSON.stringify(results, null, 2));
                        }}  catch (error) {{                       
                            trace = {{}};
                        }}
                    }}
                }}


                main();
                """)

        
        config_path = os.path.join(temp_dir, 'hardhat.config.js')
        with open(config_path, 'w') as config_file:
            config_file.write(f"""
            require("@nomiclabs/hardhat-waffle");
            require("@nomiclabs/hardhat-ethers");

            module.exports = {{
                networks: {{
                    hardhat: {{
            allowUnlimitedContractSize: true,
            blockGasLimit: 1000000000  
        }}
                }},
            }};
            """)

        
        command = 'npx hardhat run execute_transactions.js'
        subprocess.run(command, shell=True, cwd=temp_dir)
        result = {}
        for result_file in os.listdir(temp_dir):
            if 'result' not in result_file:
                continue
            txhash = result_file.split('_result')[0]
            try:
                with open(os.path.join(temp_dir, result_file),'r') as f:
                    result[txhash] = json.load(f)
            except Exception as e:
                continue
        return result

def execute_test_cases_in_folder_and_record_trace(test_case_folder):
    print("Executing test cases and saving execution traces to folder", test_case_folder)
    for file in os.listdir(test_case_folder):

        if file.endswith('.json') and file.split('.')[0].isnumeric() and file.split('.')[1] == 'json' :
            test_case_id = file.split('.')[0]
            with open(os.path.join(test_case_folder, file), 'r') as f:
                transactions = json.load(f)
                transaction_hashes = [tx['hash'] for tx in transactions]
                result = execute_transactions(transactions, transaction_hashes)
                with open(os.path.join(test_case_folder, test_case_id+"_result.json"), 'w+') as fo:
                    json.dump(result, fo)
    

def fetch_and_save_traces(contract_address, contract_id,  args, etherscan_api_key, geth_provider_url, max_transactions):
    trace_folder = os.path.join(args.augmentation_folder, 'historical_tx_trace', contract_id)
    if not os.path.exists(trace_folder):
        os.makedirs(trace_folder)

    def get_transactiones(api_key, start_block=0, end_block=99999999, page=1, offset=10000, sort='asc'):
        url = f'https://api.etherscan.io/api?module=account&action=txlist&address={contract_address}&startblock={start_block}&endblock={end_block}&page={page}&offset={offset}&sort={sort}&apikey={api_key}'
        response = requests.get(url)
        data = response.json()
        if data['status'] == '1':
            return data['result']
        return []
    
        
    def get_internal_transactions(contract_address, args):
        if not os.path.exists(os.path.join(args.contract_folder, 'Tx_History', contract_address + '_internal.json')):
            return []
        with open(os.path.join(args.contract_folder, 'Tx_History', contract_address + '_internal.json'), 'r') as f:
            internal_txInfo = json.loads(f.read())
            result = []
            for tx in internal_txInfo:
                if tx['trace_address'] == None:
                    continue
                converted_tx = {
                        "blockNumber": tx.get("block_number"),
                        "hash": tx.get("transaction_hash", ""),
                        "transactionIndex": tx.get("transaction_index"),
                        "from": tx.get("from_address", ""),
                        "to": tx.get("to_address", ""),
                        "value": tx.get("value", ""),
                        "gas": tx.get("gas", ""),
                        "isError": "0" if tx.get("error") is None else "1",
                        "input": tx.get("input", ""),
                        "methodId": tx.get("input", "")[:10] if tx.get("input") else "",
                        'trace_address': tx.get("trace_address", ""),
                        "isInternal": True,
                    }
                result.append(converted_tx)
            return result

    def get_trace(transaction_hash, provider_url):
        web3 = Web3(Web3.HTTPProvider(provider_url))
        trace = web3.provider.make_request('debug_traceTransaction', [transaction_hash, {}])
        return trace['result']

    def save_trace(trace, transaction_hash, transaction_number):
        file_path = os.path.join(trace_folder, f'{transaction_hash}.json')
        with open(file_path, 'w+') as f:
            json.dump(trace, f)
            
    if not os.path.exists(os.path.join(args.contract_folder, 'Tx_History', contract_id + '_external.json')):
        txInfo = get_transactiones(etherscan_api_key)
        with open(os.path.join(args.contract_folder, 'Tx_History', contract_id + '_external.json'), 'w+') as f:
                json.dump(txInfo, f)
    else:
        with open(os.path.join(args.contract_folder, 'Tx_History', contract_id + '_external.json'), 'r') as f:
            txInfo = json.loads(f.read())
    
    internal_txns = get_internal_transactions(contract_id, args)
    
    for internal_tx in internal_txns:
        txInfo.append(internal_tx)
    for i in range(0,len(txInfo)):
        if 'trace_address' in txInfo[i]:
            try:
                txInfo[i]['trace_address'] = [int(part) for part in txInfo[i]['trace_address'].split(',')]
            except:
                txInfo[i]['trace_address'] = [-1]
        else:
            txInfo[i]['trace_address'] = [-1]
    txInfo = sorted(txInfo, key=lambda tx: (int(tx["blockNumber"]), int(tx["transactionIndex"]), tx['trace_address']))
    transaction_hashes =  [tx['hash'] for tx in txInfo]
    for i, tx_hash in enumerate(transaction_hashes[:max_transactions]):
        trace_file = os.path.join(trace_folder, f'{tx_hash}.json')
        if not os.path.exists(trace_file):
            print(f'Fetching trace for transaction {i+1}/{len(transaction_hashes)}: {tx_hash}')
            trace = get_trace(tx_hash, geth_provider_url)
            save_trace(trace, tx_hash, i)
        else:
            continue
    tx_hash_counts = {}
    for tx in txInfo:
        tx_hash = tx['hash']
        if 'isInternal' in tx and tx_hash not in tx_hash_counts: 
            tx_hash_counts[tx_hash] = 0
        if 'isInternal' in tx and tx_hash in tx_hash_counts:
            tx['hash'] = f"{tx_hash}_{tx_hash_counts[tx_hash]}"
            tx_hash_counts[tx_hash] += 1
    return txInfo[0:max_transactions]


def extract_read_write_sets_from_trace(raw_trace, tx_info):
    read_set = {}  
    write_set = {}  
    trace = raw_trace['structLogs']
    executedOps = [x['op'] for x in trace]
    for i, step in enumerate(trace):
        op = step['op']
        if op == 'SLOAD':
            if i + 1 < len(trace) and len(trace[i + 1]['stack']) >= 1:
                address = step['stack'][-1]
                value = trace[i + 1]['stack'][-1]  
                if int(address, 16) not in read_set and int(address, 16) not in write_set:
                    read_set[int(address, 16)] = int(value, 16)
        elif op == 'SSTORE':
            address = step['stack'][-1]
            value = step['stack'][-2]
            write_set[int(address, 16)] = int(value, 16)
    if tx_info['isError'] == '0' and 'isInternal' not in tx_info:
        return read_set.copy(), write_set.copy()
    elif tx_info['isError'] == '0' and 'isInternal' in tx_info and 'REVERT' not in executedOps and 'INVALID' not in executedOps:
        return read_set.copy(), write_set.copy()
    else:
        return {}, {}


def average_dependencies(graph):
    total_dependencies = 0
    for node in graph:
        total_dependencies += len(graph[node])
    average = total_dependencies / len(graph) if graph else 0
    return average

def contains_fail_prefix(txns, failed_prefixes):
    def tuple_starts_with(long_tuple, prefix_tuple):
        return long_tuple[:len(prefix_tuple)] == prefix_tuple
    for i in failed_prefixes:
        if tuple_starts_with(tuple(txns),(i)):
            return True
    return False

def diagnose(execution_traces, txns):
    fail_prefix = []
    for tx in txns:
        if tx['hash'] not in execution_traces:
            fail_prefix.append(tx['hash'])
        elif execution_traces[tx['hash']]['receipt']['status'] == int(tx['isError']): 
            fail_prefix.append(tx['hash'])
            break
        else:
            fail_prefix.append(tx['hash'])
    return fail_prefix

            

def levenshtein_distance(tup1, tup2):
    
    dp = [[0] * (len(tup2) + 1) for _ in range(len(tup1) + 1)]
    for i in range(len(tup1) + 1):
        dp[i][0] = i
    for j in range(len(tup2) + 1):
        dp[0][j] = j
    for i in range(1, len(tup1) + 1):
        for j in range(1, len(tup2) + 1):
            if tup1[i-1] == tup2[j-1]:
                cost = 0
            else:
                cost = 1
            dp[i][j] = min(dp[i-1][j] + 1,      
                           dp[i][j-1] + 1,      
                           dp[i-1][j-1] + cost) 

    return dp[-1][-1]

def tuples_similar(tup1, tup2, threshold_ratio):
    if (len(tup1)<=1 and len(tup2) > 1 or len(tup1) > 1 and len(tup2)<=1):
        return False
    min_len = min(len(tup1), len(tup2), 10000)
    max_distance = int(min_len * threshold_ratio)
    distance = levenshtein_distance(tup1[:min_len-1], tup2[:min_len-1])

    return distance <= max_distance



def same_trace(trace_a, trace_b, is_internal = False):
    if trace_a is None or trace_b is None:
        return False
    if 'failed' not in trace_a or 'failed' not in trace_b:
        return False

    if is_internal:
        execution_path_a = tuple((step['op']) for step in trace_a['structLogs'] if step['op'] not in ['KECCAK256', 'SHA3', 'POP', 'JUMPDEST', 'JUMP'])
        execution_path_b = tuple((step['op']) for step in trace_b['structLogs'] if step['op'] not in ['KECCAK256', 'SHA3', 'POP', 'JUMPDEST', 'JUMP'])
        if trace_a['failed'] == True and trace_b['failed'] == False:
            if not ('INVALID' in execution_path_b or "REVERT" in execution_path_b):
                return False

        result = tuples_similar(execution_path_a, execution_path_b, threshold_ratio = 0.1)
        return result
    else:
        if trace_a['failed'] != trace_b['failed']:
            return False
        execution_path_a = tuple((step['pc'], step['op']) for step in trace_a['structLogs'] if step['op']!='KECCAK256' and step['op']!='SHA3')
        execution_path_a = tuple((step['pc'], step['op']) for step in trace_b['structLogs'] if step['op']!='KECCAK256' and step['op']!='SHA3')
        result = tuples_similar(execution_path_a, execution_path_a, 0.1)
        return result

def normalize_address_string(hex_str):
    normalized_str = hex_str[2:].lower()
    normalized_str = normalized_str.zfill(40)
    
    return "0x" + normalized_str

def parse_internal_tx_trace(trace, trace_number, contract_address):
    filtered_trace = []
    call_stack = []  
    current_trace_number = -1
    for step in trace['structLogs']:
        
        if call_stack and call_stack[-1].lower() == contract_address.lower() and current_trace_number == trace_number:
            filtered_trace.append(step)
        if step['op'] in ['CALL', 'STATICCALL']:
            if len(step['stack']) >= 2:
                called_address_hex = step['stack'][-2]
                called_address = normalize_address_string(called_address_hex)
                if called_address.lower() ==  contract_address.lower():
                    current_trace_number = current_trace_number + 1
                call_stack.append(called_address)  
        elif step['op'] == 'RETURN' or step['op'] == 'STOP':
            if call_stack:
                call_stack.pop()  

    trace['structLogs'] = filtered_trace
    trace['is_internal_tx'] = True
    return trace


def build_dependency_graph(contract_name, txInfo, contract_address, args):
    trace_folder = os.path.join(args.augmentation_folder, 'historical_tx_trace', contract_name)
    depending = {}
    read_write_sets = {}
    tx2trace = {}
    tx2number = {}
    write_history = {}  
    first_transaction = ''
    tx2Info = {}
    for i in txInfo:
        tx2Info[i['hash']] = i
    transaction_number = 0
    
    for t in txInfo:
        transaction_hash = t['hash']
        if 'isInternal' in t: 
            filename = transaction_hash.split('_')[0] + '.json'
            trace_number = int(transaction_hash.split('_')[1])
        else:
            filename = transaction_hash + '.json'
        if transaction_number == 0:
            first_transaction = transaction_hash
            
        transaction_number = transaction_number + 1
        with open(os.path.join(trace_folder, filename), 'r') as f:
            trace = json.load(f)
            if 'isInternal' in tx2Info[transaction_hash]:
                trace = parse_internal_tx_trace(trace, trace_number, contract_address)
                
            
            read_set, write_set = extract_read_write_sets_from_trace(trace, t)
            read_write_sets[transaction_hash] = (read_set, write_set, transaction_number)
            tx2trace[transaction_hash] = trace
            
            tx2number[transaction_hash] = transaction_number
            for element in write_set:
                if element not in write_history:
                    write_history[element] = [(transaction_number, transaction_hash, write_set[element])]
                else:
                    write_history[element].append((transaction_number, transaction_hash, write_set[element]))

    for t in txInfo:
        tx = t['hash']
        (read_set, _, tx_number) = read_write_sets[tx]
        if tx not in depending:
            depending[tx] = {(first_transaction, -1)}
        if t['to'] == '':
            continue
        for element in read_set:
            writes = []
            if element in write_history:
                writes = [item for item in write_history[element] if (item[0] < tx_number) and item[2] == read_set[element]]
            if len(writes) == 0 and read_set[element]==0:
                writes = [(0,first_transaction, 0)]
                depending[tx].add((first_transaction, element))
            
            elif len(writes) > 0 :
                _, last_write_tx_hash, _ = max(writes, key=lambda x: x[0])
                depending[tx].add((last_write_tx_hash, element))
            elif read_set[element] !=0: 
                if not tx2number[tx] <= 10: 
                    depending.pop(tx)
                break
    return read_write_sets, tx2trace, tx2number, write_history, depending


def construct_independent_chain(depending, tx2number, txlist, txInfo):
    tx2Info = {}
    for i in txInfo:
        tx2Info[i['hash']] = i
    independent_chains = {}
    for target_tx in txlist:
        current_chain = {target_tx}
        newly_added = {target_tx}
        unmatched = False
        while (len(newly_added) > 0 ):
            next_round_added = set()
            for ancestor in newly_added:
                if ancestor not in depending:
                    unmatched = True
                    break
                for tx, _ in depending[ancestor]:
                    if tx not in current_chain:
                        current_chain.add(tx)
                        next_round_added.add(tx)
            if unmatched:
                break
            newly_added = next_round_added
        if not unmatched:
            current_chain = list(set(current_chain))
            current_chain = sorted(current_chain, key=lambda x: tx2number[x])
            for tx in current_chain[1:-1]:
                if tx2Info[tx]['isError'] == 1:
                    current_chain.remove(tx)
            independent_chains[target_tx] = current_chain
    
    return independent_chains
            


def find_shortest_ancestor_chain(possible_ancestors, tx2number, txlist):
    shortest_chains = {}

    for target_tx in txlist:
        if target_tx not in possible_ancestors and tx2number[target_tx]!=0:
            continue
        
        queue = [(target_tx, {target_tx})]
        visited = set()
        shortest_lengths = {}  

        while queue:
            current_tx, chain = queue.pop(0)

            if current_tx not in visited:
                visited.add(current_tx)
                
                if tx2number[current_tx] == 0:
                    
                    shortest_chains[target_tx] = chain
                    break
                else:
                    
                    for ancestor in possible_ancestors[current_tx]:
                        new_chain = chain | {ancestor}
                        
                        if ancestor not in shortest_lengths or len(new_chain) < shortest_lengths[ancestor]:
                            queue.append((ancestor, new_chain))
                            shortest_lengths[ancestor] = len(new_chain)
        if target_tx not in shortest_chains:
            shortest_chains[target_tx] = set(tx2number.keys())
    
    
    
    
    
    
    
    
    for tx in shortest_chains:
        shortest_chains[tx] = sorted(shortest_chains[tx], key=lambda x: tx2number[x])


    return shortest_chains




def cluster_transactions_by_execution_path(tx2trace, txInfo):
    tx2Info = {}
    for i in txInfo:
        tx2Info[i['hash']] = i
    
    path_to_txs = {}
    handled = set()

    for tx_hash, t in tx2trace.items():
        if '_' in tx_hash:
            continue
        if tx_hash in handled:
            continue
        if 'failed' not in t or 'structLogs' not in t:
            continue
        if t['failed'] == True and not (t['structLogs'][-1]['op'] == 'REVERT' or t['structLogs'][-1]['op'] == 'INVALID'): 
            continue
        handled.add(tx_hash)
        trace = t['structLogs']
        isInternal = False
        if 'isInternal' in tx2Info[i['hash']]:
            isInternal = True
            
        
        execution_path = tuple((step['op']) for step in trace if step['op'] not in ['KECCAK256', 'SHA3', 'POP', 'JUMPDEST', 'JUMP'])
        maching_path = execution_path
        if isInternal:
            for existing_path in path_to_txs:
                if (str(execution_path)[1:-1] in str(existing_path)[1:-1]):
                    maching_path = execution_path
                    break
        else:
            for existing_path in path_to_txs:
                if (str(existing_path)[1:-1] in str(execution_path)[1:-1]):
                    maching_path = execution_path
                    break
        
        if maching_path not in path_to_txs:
            path_to_txs[maching_path] = [tx_hash]
        else:
            path_to_txs[maching_path].append(tx_hash)

    
    clusters = list(path_to_txs.values())

    return clusters

def preserve_execution_result(should_preserve, execution_result, tx2trace, compare_with_local_trace=False):
    preserve = True
    for tx in should_preserve:
        if tx not in execution_result or 'trace' not in execution_result[tx]:
            return False
        if 'failed' not in execution_result[tx]['trace']: 
            return (tx2trace[tx]['failed']==False)==(execution_result[tx]['receipt']['status']==1)
        if '_' in tx and compare_with_local_trace: 
            preserve = preserve & same_trace(execution_result[tx]['trace'], tx2trace[tx], True) 
        else: 
            preserve = preserve & same_trace(execution_result[tx]['trace'], tx2trace[tx], False) 
    return preserve

def greedy_fold_transactions(tx_chain, tx_to_fold, shortest_chains, write_history, tx2rwset, tx2trace, tx2number, dependency, txInfo, end_time, should_preserve, failed_prefixes=set()):
    if len(tx_chain) <= 2 or tx_chain[0] == tx_to_fold:
        return tx_chain
    
    current_time = time.time()
    if current_time >= end_time:
        return tx_chain
    
    last_tx = tx_chain[-1]
    first_tx = tx_chain[0]
    
    tx_is_required_by = {}
    for tx in reversed(tx_chain):
        for element in tx2rwset[tx][0]:
            if element in write_history:
                prev_writes = [item[1] for item in write_history[element] if item[0] < tx2number[tx] ]
                prev_txns = [prev_tx for prev_tx in tx_chain if prev_tx in prev_writes]
                prev_txns = sorted(prev_txns, key= lambda k: tx2number[k])
                if len(prev_txns) == 0:
                    prev_txns = [tx_chain[0]]
                if prev_txns[-1] not in tx_is_required_by:
                    tx_is_required_by[prev_txns[-1]] = [(tx, element, prev_txns[:-1])]
                else:
                    tx_is_required_by[prev_txns[-1]].append((tx, element, prev_txns[:-1]))
            else:
                tx_is_required_by[tx_chain[0]] = [(tx, element,[])]

    
    try2delete = {}
    
    if tx_to_fold not in tx_is_required_by and tx_to_fold not in should_preserve:
        
        new_chain = tx_chain.copy()
        new_chain.remove(tx_to_fold)
        new_chain = sorted(new_chain, key=lambda x: tx2number[x])
        new_chain_txns = [[x for x in txInfo if x['hash']== tx][0] for tx in new_chain]
        new_chain_txns = sorted(new_chain_txns, key=lambda x: tx2number[x['hash']])
            
        execute_result = execute_transactions(new_chain_txns, should_preserve)
        isInternal = False
        if '_' in last_tx:
            isInternal = True
        if preserve_execution_result(should_preserve, execute_result, tx2trace): 
            next_folding_point = [tx for tx in new_chain if tx2number[tx]< tx2number[tx_to_fold]][-1]
            return greedy_fold_transactions(new_chain, next_folding_point, shortest_chains, write_history, tx2rwset, tx2trace, tx2number, dependency, txInfo, end_time, should_preserve, failed_prefixes)
        else:
            next_folding_point = [tx for tx in tx_chain if tx2number[tx]< tx2number[tx_to_fold]][-1]
            return greedy_fold_transactions(tx_chain, next_folding_point, shortest_chains, write_history, tx2rwset, tx2trace, tx2number, dependency, txInfo, end_time, should_preserve, failed_prefixes)
    elif tx_to_fold in should_preserve:
        next_folding_point = [tx for tx in tx_chain if tx2number[tx] < tx2number[tx_to_fold]][-1]

        return greedy_fold_transactions(tx_chain, next_folding_point, shortest_chains, write_history, tx2rwset, tx2trace, tx2number, dependency, txInfo, end_time, should_preserve, failed_prefixes)
    
    for post_tx, element, alternative_ancestors in tx_is_required_by[tx_to_fold]:
        folding_chain = [tx_to_fold]
        try2delete[element] = [(folding_chain.copy(),0)]
        alternative_ancestors = alternative_ancestors.copy()
        alternative_ancestors = sorted(alternative_ancestors, key= lambda k: tx2number[k], reverse=True)
        for i, alternative in enumerate(alternative_ancestors):
            valid = False
            depends_on_alternative = set([item[0] for item in tx_is_required_by[alternative]])
            requiredBy = [item[1] for item in tx_is_required_by[tx_to_fold]]
            post_txns = set(folding_chain)
            if set(requiredBy) <= set(tx2rwset[alternative][1].keys()) and len(depends_on_alternative.difference(post_txns)) == 0:
                valid = True
            if alternative == last_tx or alternative == first_tx:
                valid = False
            if valid:
                alternative_write_value = [item[2] for item in write_history[element] if item[1] == alternative][-1]
                folding_chain.append(alternative)
                if element not in try2delete:
                    try2delete[element] = [(folding_chain.copy(), alternative_write_value)]
                else:
                    try2delete[element].append((folding_chain.copy(), alternative_write_value))
            else:
                break
    
    
    try2delete = [(x, try2delete[x]) for x in try2delete]
    try2delete = sorted(try2delete, key=lambda k: max([len(t[0]) for t in k[1]], default=0))
    
    current_chain = tx_chain.copy()
    tried = set()
    
    for element, tx_lists in try2delete:
        original_value = [item[2] for item in write_history[element] if item[1] == tx_to_fold][0]
        last_failed_margin = 2**256
        tx_lists = sorted(tx_lists, key = lambda k: len(k[0]), reverse = True)
        element_end_time = time.time() + 100
        while len(tx_lists) > 0:
            current_time = time.time()
            if current_time >= end_time:
                print("Folding Timeout, stop folding")
                return current_chain
            if current_time >= element_end_time:
                break
            (del_txs, alternative_value) = max(tx_lists, key=lambda x: len(x[0]))
            tx_lists.remove((del_txs, alternative_value))
           
            if tuple(del_txs) not in tried:
                tried.add(tuple(del_txs))
            else:
                continue
            if len(set(del_txs).difference(set(should_preserve))) == 0:
                continue
            else:
                del_txs = list(set(del_txs).difference(set(should_preserve)))
            
            new_chain = [tx for tx in current_chain if tx not in del_txs]
            new_chain = sorted(new_chain, key=lambda x: tx2number[x])
            
            if len(new_chain) >= len(current_chain):
                continue
            if contains_fail_prefix(new_chain, failed_prefixes):
                continue
            
            new_chain_txns = [[x for x in txInfo if x['hash']== tx][0] for tx in new_chain]
            new_chain_txns = sorted(new_chain_txns, key=lambda x: tx2number[x['hash']])
            execute_result = execute_transactions(new_chain_txns, should_preserve)
            isInternal = False
            if '_' in last_tx:
                isInternal = True
            if preserve_execution_result(should_preserve, execute_result, tx2trace):
                current_chain = new_chain.copy()
                break
            else:
                failed_prefix = tuple(diagnose(execute_result, new_chain_txns))
                failed_prefixes.add(failed_prefix)
  
            
    next_folding_point = tx_to_fold
    current_chain = sorted(current_chain, key=lambda x: tx2number[x])

    if tx_to_fold in current_chain:
        for i in range(1, len(current_chain)):
            if current_chain[i] == tx_to_fold:
                next_folding_point = current_chain[i - 1]  
                break
    elif tx_to_fold not in current_chain:
        for prev in reversed(current_chain):
            if tx2number[prev] < tx2number[tx_to_fold]:
                next_folding_point = prev
                break
    
    if next_folding_point != tx_to_fold:
        return greedy_fold_transactions(current_chain, next_folding_point, shortest_chains, write_history, tx2rwset, tx2trace, tx2number, dependency, txInfo, end_time, should_preserve, failed_prefixes)
    else:
        return current_chain

def cluster_transactions_by_dependency_relation(dependency, tx2trace, txInfo, shortest_chains):
    tx2Info = {}
    for i in txInfo:
        tx2Info[i['hash']] = i
    
    dependency2testcaseNumber = {}
    cluster2shortestTestLength = {}

    selector2cluster = {}
    for tx in tx2Info:
        if len(tx2Info[tx]['input']) < 10:
            continue
        if tx not in shortest_chains:
            continue
        if tx in shortest_chains and len(shortest_chains[tx]) > 1000:
            continue
        tx_selector = tx2Info[tx]['input'][0:10]
        if tx not in tx2trace or 'structLogs' not in tx2trace[tx] or 'failed' not in tx2trace[tx]:
            continue
        t = tx2trace[tx]
        if t['failed'] == True and not (t['structLogs'][-1]['op'] == 'REVERT' or t['structLogs'][-1]['op'] == 'INVALID'): 
            continue
        if tx not in dependency:
            continue
        if tx_selector not in selector2cluster:
            selector2cluster[tx_selector] = {}
            cluster2shortestTestLength[tx_selector] = {}

        
        execution_path = []
        for i in range(0, len(tx2trace[tx]['structLogs'])-1):
            step = tx2trace[tx]['structLogs'][i]
            if step['op'] in ['JUMPI', 'JUMP']:
                execution_path.append((step['pc'], tx2trace[tx]['structLogs'][i+1]['pc']))
        execution_path = tuple(sorted(set(execution_path)))
        
        execution_status = t['failed']
        dependencies = tuple()
        
        if (dependencies, execution_path, execution_status) not in selector2cluster[tx_selector]:
            cluster2shortestTestLength[tx_selector][(dependencies, execution_path, execution_status)] = [len(shortest_chains[tx])]
            selector2cluster[tx_selector][(dependencies, execution_path, execution_status)] = {tx}
        else:
            selector2cluster[tx_selector][(dependencies, execution_path, execution_status)].add(tx)
            cluster2shortestTestLength[tx_selector][(dependencies, execution_path, execution_status)].append(len(shortest_chains[tx]))
    result = {}
    idx = 0
    for selector in selector2cluster:
        for key in selector2cluster[selector]:
            dependencies = key[0]
            if (selector, dependencies) in dependency2testcaseNumber and dependency2testcaseNumber[(selector, dependencies)] >= 10:
                continue
            if (selector, dependencies) not in dependency2testcaseNumber:
                dependency2testcaseNumber[(selector, dependencies)] = 1
            else:
                dependency2testcaseNumber[(selector, dependencies)] = dependency2testcaseNumber[(selector, dependencies)] + 1
        
            result[idx] = selector2cluster[selector][key]
            idx = idx + 1
    
    return result, selector2cluster

def test_replayer_and_recorder(source_contract_file, args):
    '''source_contract_file: contract_name + contract_address +.sol'''
    contract_name = source_contract_file['id']
    print("#"*50, "Augmenting test cases for", contract_name, "#"*50)

    contract_addr = source_contract_file['address']
    txInfo = fetch_and_save_traces(contract_addr, contract_name, args, args.etherscan_api, args.http_provider, args.max_transactions)    
    tx2rwset, tx2trace, tx2number, write_history, dependency = build_dependency_graph(contract_name, txInfo, contract_addr, args)
    txlist = [x for x in tx2number]
    shortest_chains = construct_independent_chain(dependency, tx2number, txlist, txInfo)
    tx_clusters, _ = cluster_transactions_by_dependency_relation(dependency, tx2trace, txInfo, shortest_chains)

    
    test_cases = {}
    already_covered_execution_path = set()
    for i, cluster in tx_clusters.items():    
        failed = 0

        for tx_chain in sorted(shortest_chains.values(), key=lambda k:len(k)):
            tx_chain = sorted(tx_chain, key=lambda x: tx2number[x])
            if tx_chain[-1] in cluster and i not in test_cases:
                    txns = [[x for x in txInfo if x['hash']== tx][0] for tx in tx_chain]
                    txns = sorted(txns, key=lambda x: tx2number[x['hash']])
                    tx_selector = txns[-1]['input'][0:10]
                    should_preserve = {tx_chain[-1]}
                    execute_result = execute_transactions(txns, should_preserve)
                    if len(tx_chain) == 1 or preserve_execution_result(should_preserve, execute_result, tx2trace): 
                        print(f"Augmented Testcase {i}, the tx sequence length is {len(tx_chain)}")
                        execution_path = []
                        for i in range(0, len(execute_result[tx_chain[-1]]['trace']['structLogs'])-1):
                            step = execute_result[tx_chain[-1]]['trace']['structLogs'][i]
                            if step['op'] in ['JUMPI', 'JUMP']:
                                execution_path.append((step['pc'], execute_result[tx_chain[-1]]['trace']['structLogs'][i+1]['pc']))
                        execution_path = tuple(sorted(set(execution_path)))
                        if (tx_selector, execution_path) in already_covered_execution_path:
                            break
                        else:
                            already_covered_execution_path.add((tx_selector, execution_path))
                            test_cases[i] = tx_chain
                            break
                    else:
                        failed = failed + 1
                        if failed >= 3:
                            break
                        
    re_numbered_test_cases = {}
    number = 0
    for i in test_cases:
        re_numbered_test_cases[number] = test_cases[i]
        number = number + 1
    test_cases = re_numbered_test_cases
    

    for i in test_cases:
        previous_length = len(test_cases[i])
        if len(test_cases[i]) > 2 :
            try:
                time_limit = args.folding_timeout
                end_time = time.time() + time_limit
                should_preserve = {test_cases[i][-1]}
                new_testcase = greedy_fold_transactions(test_cases[i], test_cases[i][-2], shortest_chains, write_history, tx2rwset, tx2trace, tx2number, dependency, txInfo, end_time, should_preserve)
                test_cases[i] = new_testcase.copy()
            except Exception as e:
                test_cases[i] = test_cases[i]
        print(f"Fold test_case {i} from {previous_length} txs to {len(test_cases[i])} txs")


    for i in test_cases:
        tx_data = []
        for tx in test_cases[i]:
            d = [x for x in txInfo if x['hash']== tx][0]
            tx_data.append(d)
        test_cases[i] = tx_data
    test_case_folder = os.path.join(args.augmentation_folder, 'augmented_test_case', contract_name)
    save_test_cases(test_case_folder, test_cases)
    execute_test_cases_in_folder_and_record_trace(test_case_folder)

    