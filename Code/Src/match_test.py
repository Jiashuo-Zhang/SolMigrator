from collections import Counter
from eth_abi import encode, decode


def are_permutations(list1, list2):
    return Counter(list1) == Counter(list2)


def exact_match_test_case(source_test_cases, source_contract_selectors, target_contract_selectors, source_func_to_target):
    '''Exact match'''
    result = {}
    for test_case in source_test_cases:
        matchedTxns = []
        for tx in source_test_cases[test_case]['transactions']:
            source_selcector = tx['input'][:10]
            if tx['to'] != '':
                if source_selcector.lower() not in source_contract_selectors:
                    continue
                matched_function = []
                for target_selector in target_contract_selectors:
                    if source_contract_selectors[source_selcector]['name'] in source_func_to_target and target_contract_selectors[target_selector]['name']  == source_func_to_target[source_contract_selectors[source_selcector]['name']]:
                        matched_function.append(target_selector)
                        break

                if len(matched_function) >= 1:
                    modified_tx = tx.copy()
                    try:
                        modified_tx_input = migrate_test_input(source_contract_selectors[source_selcector]['input'], target_contract_selectors[matched_function[0]]['input'], tx['input'][10:])
                        modified_tx['input'] = matched_function[0] + modified_tx_input 
                    except:
                        modified_tx['input'] =  matched_function[0] + tx['input'][10:]
                    matchedTxns.append(modified_tx)
            else:
                matchedTxns.append(tx.copy())

        if len(matchedTxns) == len(source_test_cases[test_case]['transactions']):
            result[test_case] = {
                "transactions": matchedTxns,
                "assertions": source_test_cases[test_case]['assertions'],
            }

    return result


def migrate_test_input(source_params, target_params, source_data):
    if tuple(source_params) == tuple(target_params):
        return source_data
    if len(target_params) == 0:
        return ''
    
    source_args = decode(source_params, bytes.fromhex(source_data))
    source_arg_list = []
    for i in range(0,len(source_params)):
        source_arg_list.append((source_params[i],source_args[i]))
    target_args = []
    used_slots = set()
    for i in range(0,len(target_params)):
        matched = False
        for j in range(0,len(source_arg_list)):
            if source_arg_list[j][0] == target_params[i]:
                target_args.append(source_arg_list[j][1])
                matched = True
                break
        if matched == False:
            for j in range(0,len(source_arg_list)):
                if 'uint' in source_arg_list[j][0] and 'uint' in target_params[i]:
                    target_args.append(source_arg_list[j][1])
                    matched = True
                    break
    target_data = encode(target_params, target_args).hex()
    

    return target_data

def partial_match_test_case(source_test_cases, source_contract_selectors, target_contract_selectors, source_func_to_target):
    '''partial match'''
    result = {}
    unmatched_Functions = {}
    matched_Funtions = {}
    full_sequence = {}
    for test_case in source_test_cases:
        unmatched_Functions[test_case] = []
        matched_Funtions[test_case] = []
        matchedTxns = []
        full_sequence[test_case] = []
        for tx in source_test_cases[test_case]['transactions']:
            source_selcector = tx['input'][:10]
            if tx['to'] != '' and source_selcector.lower() in source_contract_selectors:
                matched_function = []
                full_sequence[test_case].append((tx['hash'], source_contract_selectors[source_selcector]['name'], source_selcector))
                
                for target_selector in target_contract_selectors:
                    if source_contract_selectors[source_selcector]['name'] in source_func_to_target and target_contract_selectors[target_selector]['name'] == source_func_to_target[source_contract_selectors[source_selcector]['name']]:
                        matched_function.append(target_selector)
                        matched_Funtions[test_case].append((tx['hash'], source_contract_selectors[source_selcector]['name'], target_contract_selectors[target_selector]['name']))
                        break
                if len(matched_function)>=1:
                    modified_tx = tx.copy()
                    try:
                        modified_tx_input = migrate_test_input(source_contract_selectors[source_selcector]['input'], target_contract_selectors[matched_function[0]]['input'], tx['input'][10:])
                        modified_tx['input'] = matched_function[0] + modified_tx_input 
                    except:
                        modified_tx['input'] =  matched_function[0] + tx['input'][10:]
                    matchedTxns.append(modified_tx)
                else:
                    unmatched_Functions[test_case].append((tx['hash'], source_contract_selectors[source_selcector]['name'], source_selcector))
            elif tx['to'] != '' and source_selcector.lower() not in source_contract_selectors:
                if source_selcector in target_contract_selectors:
                    matchedTxns.append(tx.copy())
                    full_sequence[test_case].append((tx['hash'], source_selcector, source_selcector))
                else:
                    unmatched_Functions[test_case].append((tx['hash'], source_selcector, source_selcector))
            else:
                matchedTxns.append(tx.copy())
                matched_Funtions[test_case].append((tx['hash'], 'constructor', 'constructor'))
                full_sequence[test_case].append((tx['hash'], 'constructor', source_selcector))

        if len(matchedTxns) >= 2 and len(matchedTxns) < len(source_test_cases[test_case]['transactions']) and matchedTxns[-1]['hash'] == source_test_cases[test_case]['transactions'][-1]['hash']:
            Txhashes = [x['hash'] for x in matchedTxns]
            result[test_case] = {
                "transactions": matchedTxns,
                "assertions": {k:v for k,v in source_test_cases[test_case]['assertions'].items() if k in Txhashes},
                'isPartial': True
            }

    return result, unmatched_Functions, matched_Funtions, full_sequence


def levenshtein_distance(str1, str2):
    """计算两个字符串之间的Levenshtein编辑距离。"""
    m, n = len(str1), len(str2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if str1[i - 1] == str2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])

    return dp[m][n]

def similarity(str1, str2):
    """计算两个字符串的相似度。"""
    dist = levenshtein_distance(str1, str2)
    max_len = max(len(str1), len(str2))
    return 1 - dist / max_len
