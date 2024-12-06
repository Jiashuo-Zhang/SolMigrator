from slither.core.solidity_types.mapping_type import MappingType
from slither.slithir.operations import EventCall, InternalCall, SolidityCall, InternalDynamicCall
from slither.slithir.operations import Index
from slither.analyses.data_dependency.data_dependency import is_dependent
from Crypto.Hash import keccak
from eth_abi import encode, decode
import re
import random
import itertools

import networkx as nx 

import logging
import operator
import sys
import traceback
from argparse import Namespace


logger = logging.getLogger("Slither-simil")



def exact_match_function(source_slither_instance, target_slither_instance):
    
    def get_contract_function_signatures(slither_instance):
        function_signatures = {}
        for function in slither_instance.functions:
            
            input_types = ','.join([str(param.type) for param in function.parameters])
            signature = f"{function.name}({input_types})"
            function_signatures[signature] = function 
        return function_signatures

    source_signatures = get_contract_function_signatures(source_slither_instance)
    target_signatures = get_contract_function_signatures(target_slither_instance)

    matched = {}  
    for target_signature, target_function in target_signatures.items():
        if target_signature in source_signatures:
            matched[target_function.name] = source_signatures[target_signature].name  
        else:
            matched[target_function.name] = None
    return matched

def deep_match_function(source_slither_instance, target_slither_instance):
    def get_func_visibility_and_inputs_and_views(slither_instance):
        vis = {}
        inputs = {}
        views = {}
        for function in slither_instance.functions:
            if function.visibility == 'public' or function.visibility == 'external':
                vis[function.name] = True
            else:
                vis[function.name] = False
           
            views[function.name] = function.view
            _, inputs[function.name], _ = function.signature
            inputs[function.name] = tuple(inputs[function.name])
        for modifier in slither_instance.modifiers:
            vis[modifier.name] = False
            views[modifier.name] = True
        return vis, inputs, views
    
    
    
    def get_func_call_relation(slither_instance):
        
        def merge_calls(func_name, visited):
            
            if func_name in visited:
                return set()
            visited.add(func_name)
            
            all_calls = set(func2called_func[func_name])
            for called_name in list(func2called_func[func_name]):
                if called_name in func2called_func:
                    all_calls.update(merge_calls(called_name, visited))
            
            
            func2called_func[func_name] = list(all_calls)

            return all_calls
        
        func2called_func = {}
        for func in slither_instance.functions:
            if func.name not in func2called_func:
                func2called_func[func.name] = []
            for node in func.nodes:
                for ir in node.irs:
                    if isinstance(ir, InternalCall) or isinstance(ir, InternalDynamicCall) or isinstance(ir, SolidityCall):
                        if ir.function in slither_instance.functions or ir.function in slither_instance.modifiers :
                            func2called_func[func.name].append(ir.function.name)

        for func_name in func2called_func.keys():
            merge_calls(func_name, set())
        return func2called_func
    
    def get_func_data_dependency_relation(slither_instance, func2call):
        func2write_state = {}
        func2read_state = {}
        is_self_contained = {}
        for function in slither_instance.functions:
            if function.name not in func2read_state:
                func2read_state[function.name] = set()
            if function.name not in func2write_state:
                func2write_state[function.name] = set()
            for i in function.state_variables_read:
                func2read_state[function.name].add(i.name)
            for i in function.state_variables_written:
                
                func2write_state[function.name].add(i.name)
        for caller in func2call:
            for callee in func2call[caller]:
                matched = False
                for ff in (slither_instance.functions):
                    if ff.name == callee:
                        callee = ff
                        matched = True
                for ff in (slither_instance.modifiers):
                    if ff.name == callee:
                        callee = ff
                        matched = True
                if not matched:
                    continue
                for i in callee.state_variables_read:
                    
                        func2read_state[caller].add(i.name)
                for i in callee.state_variables_written:
                        func2write_state[caller].add(i.name)
        for func in func2read_state:
            if func2read_state[func] <= func2write_state[func]:
                is_self_contained[func] = True
            else:
                is_self_contained[func] = False
                    
        func2influenced_func = {}
        for func1, func2 in itertools.permutations(slither_instance.functions, 2):
            if func1.name not in func2influenced_func:
                func2influenced_func[func1.name] = set()
            if len(func2write_state[func1.name] & (func2read_state[func2.name])) > 0:
                func2influenced_func[func1.name].add(func2.name)
                
        for caller in func2influenced_func:
            for callee in func2call[caller]:
                if callee in func2influenced_func:
                    func2influenced_func[caller].update(func2influenced_func[callee])
            if caller not in func2influenced_func[caller]:
                func2influenced_func[caller].add(caller)
        
        return func2influenced_func, is_self_contained

    source_func_call = get_func_call_relation(source_slither_instance)
    target_func_call = get_func_call_relation(target_slither_instance)
    target_func_vis, target_func_inputs, target_func_views = get_func_visibility_and_inputs_and_views(target_slither_instance)
    source_func_vis, source_func_inputs, source_func_views = get_func_visibility_and_inputs_and_views(source_slither_instance)
    source_func_dependency, is_self_contained_source  = get_func_data_dependency_relation(source_slither_instance, source_func_call)
    target_func_dependency, is_self_contained_target = get_func_data_dependency_relation(target_slither_instance, target_func_call)

    for i in source_func_call:
        for j in source_func_call[i]:
            if source_func_views[j]:
                source_func_call[i].remove(j)
    
    for i in target_func_call:
        for j in target_func_call[i]:
            if target_func_views[j]:
                target_func_call[i].remove(j)        
    
    target_to_source = exact_match_function(source_slither_instance, target_slither_instance)
    source_to_target =  {k:v for k,v in target_to_source.items() if v is not None}
    for func in source_slither_instance.functions:
        if func.name not in source_to_target:
            source_to_target[func.name] = None

    
    for source_func_name in source_func_call:
        if source_func_name in source_to_target and source_to_target[source_func_name] is not None:
            continue
        if source_func_name == source_slither_instance.constructor.name:
            continue
        max_match = 0
        for target_func_name in target_func_call:
            if not target_func_vis[target_func_name]:
                continue
            if source_func_views[source_func_name] != target_func_views[target_func_name]:
                continue
            if target_func_name == target_slither_instance.constructor.name:
                continue
            if not (source_func_inputs[source_func_name] == target_func_inputs[target_func_name] or same_signature_except_uint(source_func_inputs[source_func_name], target_func_inputs[target_func_name])):
                continue
            if not source_func_vis[source_func_name]:
                continue
            if source_func_views[source_func_name] != target_func_views[target_func_name]:
                continue
            both_call = set()
            for func in source_func_call[source_func_name]:
                if func in source_to_target and source_to_target[func] in target_func_call[target_func_name]:
                    if source_to_target[func] == target_func_name and func != source_func_name:
                        continue
                    both_call.add(func)
            if len(both_call) > max_match:
                source_to_target[source_func_name] = target_func_name
                max_match = len(both_call)


    
    for source_func_name in source_func_dependency:
        max_both_call = 0
        if source_func_name in source_to_target and source_to_target[source_func_name] is not None:
            continue
        if source_func_name == source_slither_instance.constructor.name:
            continue
        if not source_func_vis[source_func_name]:
            continue
        for target_func_name in target_func_dependency:
            if source_func_views[source_func_name] or target_func_views[target_func_name]:
                continue
            if not target_func_vis[target_func_name]:
                continue
            if not (source_func_inputs[source_func_name] == target_func_inputs[target_func_name] or same_signature_except_uint(source_func_inputs[source_func_name], target_func_inputs[target_func_name])):
                continue
            if target_func_name == target_slither_instance.constructor.name:
                continue
            if not is_self_contained_source[source_func_name] == is_self_contained_target[target_func_name]:
                continue
            both_call = set()
            for func in source_func_dependency[source_func_name]:
                if func in source_to_target and source_to_target[func] in target_func_dependency[target_func_name]:
                    if source_to_target[func] == target_func_name and func != source_func_name:
                        continue
                    both_call.add(func)
            
            if len(both_call) > max_both_call:
                max_both_call = len(both_call)
                source_to_target[source_func_name] = target_func_name
           
    
    for source_func_name in source_func_dependency:
        if source_func_name in source_to_target and source_to_target[source_func_name] is not None:
            continue
        if source_func_name == source_slither_instance.constructor.name:
            continue
        if not source_func_vis[source_func_name]:
            continue
        max_both_call = 0
        for target_func_name in target_func_dependency:
            if target_func_name == target_slither_instance.constructor.name or (target_func_name in source_to_target and source_to_target[target_func_name]==target_func_name):
                continue
            if not is_self_contained_source[source_func_name] == is_self_contained_target[target_func_name]:
                continue
            if not (target_func_vis[target_func_name] and source_func_vis[source_func_name]):
                continue
            if target_func_views[target_func_name] or source_func_views[source_func_name]:
                continue
            if not set(source_func_inputs[source_func_name]) >= set(target_func_inputs[target_func_name]):
                continue
            both_call = set()
            for func in source_func_dependency[source_func_name]:
                if func in source_to_target and source_to_target[func] in target_func_dependency[target_func_name]:
                    if source_to_target[func] == target_func_name and func != source_func_name:
                        continue
                    both_call.add(func)
                
            if len(both_call) > max_both_call or (len(both_call) == max_both_call and max_both_call > 0 and set(source_func_inputs[source_func_name])&set(target_func_inputs[target_func_name]) > set(source_func_inputs[source_func_name])&set(target_func_inputs[source_to_target[source_func_name]])) :
                max_both_call = len(both_call)
                source_to_target[source_func_name] = target_func_name

    
    source_to_target = {k:v for k,v in source_to_target.items() if v is not None}
    
    return source_to_target
    
    


def same_signature_except_uint(source_inputs, target_inputs):
    same = True
    if len(source_inputs) == len(target_inputs):
        for i in range(0, len(source_inputs)):
            if source_inputs[i] == target_inputs[i]:
                continue
            if 'uint' in source_inputs[i] and 'uint' in target_inputs[i]:
                continue
            same = False
            break
        return same
    return False
            
                
def get_function_vars(function):
    
    def_vars = set()
    use_vars = set()

    
    def get_var_names(vars, node):
        var_names = set()
        for var in vars:
            if isinstance(var.type, MappingType):
                
                key_expr = get_key_expression(node, var)
                
                var_name = var.name
            else:
                var_name = var.name
            var_names.add(var_name)
        return var_names

    if hasattr(function, 'nodes'):  
        
        nodes = function.nodes if hasattr(function, 'nodes') else function.cfg.nodes
        for node in nodes:
            def_vars.update(get_var_names(node.state_variables_written, node))
            use_vars.update(get_var_names(node.state_variables_read, node))
    elif hasattr(function, 'cfg'):  
        for node in function.cfg.nodes:  
            def_vars.update(get_var_names(node.state_variables_written, node))
            use_vars.update(get_var_names(node.state_variables_read, node))
    return def_vars, use_vars

def get_key_expression(node, mapping_var):
    
    for ir in node.irs:
        
        if isinstance(ir, Index) and ir.variable_left == mapping_var:
            
            return str(ir.variable_right)
    return 'unknown'


def build_function_relations(contract):
    
    function_relations = {}

    
    function_vars = {}
    for function in contract.functions:
        def_vars, use_vars = get_function_vars(function)
        
        for internal_call in function.internal_calls:
                
                called_def_vars, called_use_vars = get_function_vars(internal_call)
                def_vars.update(called_def_vars)
                use_vars.update(called_use_vars)
        function_vars[function.name] = {'def': def_vars, 'use': use_vars}


    
    for func_a, vars_a in function_vars.items():
        for func_b, vars_b in function_vars.items():
            if func_a != func_b:
                
                shared_def = vars_a['def'] & vars_b['def']
                if shared_def:
                    if func_a not in function_relations:
                        function_relations[func_a] = []
                    function_relations[func_a].append((func_b, 'def-def', shared_def))
                
                
                shared_use = vars_a['use'] & vars_b['use']
                if shared_use:
                    if func_a not in function_relations:
                        function_relations[func_a] = []
                    function_relations[func_a].append((func_b, 'use-use', shared_use))

                
                shared_def_use = vars_a['def'] & vars_b['use']
                if shared_def_use:
                    if func_a not in function_relations:
                        function_relations[func_a] = []
                    function_relations[func_a].append((func_b, 'def-use', shared_def_use))

                
                shared_use_def = vars_a['use'] & vars_b['def']
                if shared_use_def:
                    if func_a not in function_relations:
                        function_relations[func_a] = []
                    function_relations[func_a].append((func_b, 'use-def', shared_use_def))

    return function_relations

def analyze_constructor_dependencies(contract):
    
    constructor = contract.constructor
    if not constructor:
        raise ValueError(f"No constructor found for contract {contract.name}")

    
    dependencies = {state_var: [] for state_var in contract.state_variables}
    for state_var in constructor.state_variables_written:
        for param in constructor.parameters:
            if is_dependent(state_var, param, contract):
                dependencies[state_var].append(param)
    
   
    constructors = [contract.constructor]
    for inherited_contract in contract.inheritance:
        if inherited_contract.constructor:
            constructors.append(inherited_contract.constructor)

    assignment_expressions = {}
    for constructor in constructors:
        for node in constructor.nodes:
            for ir in node.irs:
                if hasattr(ir, 'lvalue'):
                    if ir.lvalue in constructor.state_variables_written:
                        
                        state_var = ir.lvalue
                        expression = ir.rvalue
                        assignment_expressions[state_var] = f"{state_var.name} = {expression}"
                    elif hasattr(ir.lvalue, 'expression') and ir.lvalue.expression in contract.state_variables:
                        
                        state_var = ir.lvalue.expression
                        key = ir.lvalue.arguments[0]
                        value = ir.rvalue
                        assignment_expressions[state_var] = f"{state_var.name}[{key}] = {value}"

    params2type = {}
    params2state = {}
    for var, params in dependencies.items():
        for p in [p for p in params]:  
            if p not in params2state:
                params2state[p.name] = [var.name]
            elif var.name not in params2state[p]:
                params2state[p.name].append(var.name)
            try:
                params2type[p.name] = p.type.name
            except:
                continue
    return params2state, params2type

    
def constructor_state_to_functions(contract_instance):
    constructor_written_vars = contract_instance.constructor.state_variables_written

    function_relations = build_function_relations(contract_instance)

    state_to_functions = {}
    for var in constructor_written_vars:
        state_to_functions[var.name] = []
        for func_name, relations in function_relations.items():
            for relation in relations:
                if func_name != contract_instance.constructor.name and contract_instance.constructor.name != relation[0] and var.name in relation[2] and relation[1] in ['def-use', 'def-def']:
                    state_to_functions[var.name].append(func_name)
                    break 
    return state_to_functions




def get_function_selectors(slither_instance, onlyCallable = False):
    function_selectors = {}
    for contract in slither_instance.contracts:
        for function in contract.functions:
            if onlyCallable and not (function.visibility == "external" or function.visibility == 'public'):
                continue
            function_name, param_types, return_value_types = function.signature
            function_signature = f"{function_name}({','.join(param_types)})"
            function_selector = '0x' + keccak.new(digest_bits=256).update(function_signature.encode()).digest()[:4].hex()
            function_selectors[function_selector] = {
                'name': function_name,
                'input': param_types,
                'return': return_value_types,
            }
            
    return function_selectors

def get_function_selectors_from_contract_instance(slither_instance):
    function_selectors = {}
    for function in slither_instance.functions:
        function_name, param_types, return_value_types = function.signature
        function_signature = f"{function_name}({','.join(param_types)})"
        function_selector = '0x' + keccak.new(digest_bits=256).update(function_signature.encode()).digest()[:4].hex()
        function_selectors[function_selector] = {
            'name': function_name,
            'input': param_types,
            'return': return_value_types,
            'payable': function.payable,
        }
        
        
    return function_selectors

def match_events(source_contract_instance, target_contract_instance, source_func_to_target_func):
    def find_events_emitted_by_functions(contract_instance):
        
        events_emitted = {}

        
        for func in contract_instance.functions:
            for node in func.nodes:
                for ir in node.irs:
                    if isinstance(ir, EventCall):
                        event_name = ir.name
                        if event_name not in events_emitted:
                            events_emitted[event_name] = []
                        if func not in events_emitted[event_name]:
                            events_emitted[event_name].append(func)
        
        for func in contract_instance.functions:
            for node in func.nodes:
                for ir in node.irs:
                    if isinstance(ir, InternalCall) or isinstance(ir, SolidityCall) or isinstance(ir, InternalDynamicCall):
                        called_func = ir.function

                        for event in events_emitted:
                            if called_func in events_emitted[event] and func not in events_emitted[event]:
                                events_emitted[event].append(func)
        events_emitted = {k: list(set([func.name for func in v if func.visibility == 'external' or func.visibility == 'public'])) for k, v in events_emitted.items()}  

        return events_emitted
    source_event_to_function = find_events_emitted_by_functions(source_contract_instance)
    target_event_to_function = find_events_emitted_by_functions(target_contract_instance)

    for i in source_event_to_function:
        source_event_to_function[i] = [x for x in source_event_to_function[i] if x in source_func_to_target_func.keys() and source_func_to_target_func[x] is not None]
    for i in target_event_to_function:
        target_event_to_function[i] = [x for x in target_event_to_function[i] if x in source_func_to_target_func.values()]

    matched_params = {}
    
    for event_t in target_event_to_function:
        for event_s in source_event_to_function:
            if set(target_event_to_function[event_t]) == set(source_event_to_function[event_s]) and len(target_event_to_function[event_t]) > 0:
                matched_params[event_t] = event_s
                break
            elif set(target_event_to_function[event_t]) & set(source_event_to_function[event_s]) and event_t == event_s:
                matched_params[event_t] = event_s
                break

    
    
    G = nx.Graph()
    for source_event, source_functions in source_event_to_function.items():
        for target_event, target_functions in target_event_to_function.items():
            if (set(source_functions) & set(target_functions)) and target_event not in matched_params and source_event not in matched_params.values():
                G.add_edge(source_event + "_source", target_event + "_target")

    
    matched_result = nx.max_weight_matching(G, maxcardinality=True)
    for k, v in matched_result:
        if k.endswith("_source") and v.endswith("_target"):
            matched_params[v[:-7]] = k[:-7]
        elif k.endswith("_target") and v.endswith("_source"):
            matched_params[k[:-7]] = v[:-7]
    return matched_params, target_event_to_function
    
def match_constructor_function_parameters(source_contract_instance, target_contract_instance, matched_functions):
    source_params2state, source_param_to_type = analyze_constructor_dependencies(source_contract_instance)
    target_params2state, target_param_to_type = analyze_constructor_dependencies(target_contract_instance)
    source_state2functions = constructor_state_to_functions(source_contract_instance)
    target_state2functions = constructor_state_to_functions(target_contract_instance)

    source_params2functions = {}
    target_params2functions = {}

    for param in source_contract_instance.constructor.parameters:
        source_params2functions[param.name + "_source"] = set()

    for param, states in source_params2state.items():
        source_params2functions[param + "_source"] = set()
        for state in states:
            if state in source_state2functions:
                source_params2functions[param + "_source"].update(source_state2functions[state])

    for param in target_contract_instance.constructor.parameters:
        target_params2functions[param.name + "_target"] = set()
    for param, states in target_params2state.items():
        target_params2functions[param + "_target"] = set()
        for state in states:
            if state in target_state2functions:
                target_params2functions[param + "_target"].update(target_state2functions[state])

    G = nx.Graph()
    for source_param, source_functions in source_params2functions.items():
        for target_param, target_functions in target_params2functions.items():
            if source_functions & target_functions:
                if source_param[:-7] in source_param_to_type and target_param[:-7] in target_param_to_type and source_param_to_type[source_param[:-7]] == target_param_to_type[target_param[:-7]]:
                    G.add_edge(source_param, target_param)

    matched_result = nx.max_weight_matching(G, maxcardinality=True)
    matched_params = {}
    for k, v in matched_result:
        if k.endswith("_source") and v.endswith("_target"):
            matched_params[v[:-7]] = k[:-7]
        elif k.endswith("_target") and v.endswith("_source"):
            matched_params[k[:-7]] = v[:-7]

    G_type = nx.Graph()
    
    added = set()
    for target_param in target_contract_instance.constructor.parameters:
        if target_param.name not in matched_params:
            for source_param in source_contract_instance.constructor.parameters:
                if source_param.name not in matched_params.values():
                    try:
                        same_type_source_params = [x for x in source_contract_instance.constructor.parameters if x.type == target_param.type]                        
                        if len(same_type_source_params) == 1 and source_param.type == target_param.type:
                            G_type.add_edge(target_param.name + "_target", source_param.name + "_source")
                            added.add(target_param.name)
                        elif len(same_type_source_params) > 1 and source_param.type == target_param.type:
                            same_type_source_param = max(same_type_source_params, key=lambda x : len(source_params2functions[x.name + '_source']))
                            if (same_type_source_param.name == source_param.name) or len(source_params2functions[same_type_source_param.name + '_source']) == 0:
                                G_type.add_edge(target_param.name + "_target", same_type_source_param.name + "_source")
                                added.add(target_param.name)
                    except Exception as e:
                        continue
    for target_param in target_contract_instance.constructor.parameters:
        if target_param.name not in matched_params and target_param.name not in added:
            for source_param in source_contract_instance.constructor.parameters:
                if source_param.name not in matched_params.values():
                    try:
                        if (source_param.type.name.startswith("uint") and target_param.type.name.startswith("uint") and int(target_param.type.name.split("uint")[-1])>=int(source_param.type.name.split("uint")[-1])) :
                            G_type.add_edge(target_param.name + "_target", source_param.name + "_source")
                    except:
                        continue
    
    type_matched_result = nx.max_weight_matching(G_type)
    type_matched_params = {}
    for k, v in type_matched_result:
        if k.endswith("_source") and v.endswith("_target"):
            type_matched_params[v[:-7]] = k[:-7]
        elif k.endswith("_target") and v.endswith("_source"):
            type_matched_params[k[:-7]] = v[:-7]

    matched_constructor_params = {}
    for target_param in target_contract_instance.constructor.parameters:
        if target_param.name in matched_params:
            matched_constructor_params[target_param.name] = matched_params[target_param.name]
        elif target_param.name in type_matched_params:
            matched_constructor_params[target_param.name] = type_matched_params[target_param.name]
        else:
            matched_constructor_params[target_param.name] = 'unknown'

    return matched_constructor_params



def parse_constructor_args(slither_instance, creation_bytecode, tx_data):
    constructor = slither_instance.constructor
    param_types = [param.type.name for param in constructor.parameters]

    encoded_args = tx_data.split(creation_bytecode)[1]    
    args = decode(param_types, bytes.fromhex(encoded_args))
    result = {}
    for i in range(0, len(constructor.parameters)):
        result[constructor.parameters[i].name] = args[i]
    return result


def convert_args(source_args, match_relation, target_slither, deployer):
    target_args = {}
    for target_param in target_slither.constructor.parameters:
        if target_param.name in match_relation and match_relation[target_param.name] in source_args:
            target_args[target_param.name] = source_args[match_relation[target_param.name]]
        else:
            param_type = target_param.type.name
            if param_type.startswith('uint') or param_type.startswith('int'):
                bit_length = int(param_type[4:]) if param_type.startswith('uint') else int(param_type[3:])
                if bit_length > 8 and bit_length <= 128:
                    default_value = random.randint(0, 10000000)
                elif bit_length > 128:
                    default_value = 10**30 * random.randint(0, 10000000)
                else:
                    default_value = random.randint(0, 10)
            elif param_type.startswith('bytes'):
                default_value = bytes(''.join(random.choices('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', k = random.randint(1,10))), 'utf-8')
            elif param_type == 'string':
                default_value = ''.join(random.choices('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', k = random.randint(1,10)))
            elif param_type == 'bool':
                default_value = True
            elif param_type.startswith('address'):
                default_value = deployer
            else:
                default_value = None 
            target_args[target_param.name] = default_value
    return target_args

def encode_target_args(target_slither_instance, target_args):
    constructor = target_slither_instance.constructor
    param_types = [param.type.name for param in constructor.parameters]
    target_value = []
    for param in constructor.parameters:
        target_value.append(target_args[param.name])
    encoded_args = encode(param_types, target_value)
    return encoded_args.hex()


    
    
    


def migrate_creation_bytecode(testcases, target_creation_bytecode, source_creation_bytecode, source_slither, target_slither, matched_functions):
    source_tx_data = ''
    deployer = ''
    for testcase in testcases.values():
        source_tx_data = testcase["transactions"][0]['input']
        deployer = testcase["transactions"][0]['from']
        break
    match_relation = match_constructor_function_parameters(source_slither, target_slither, matched_functions)

    source_args = parse_constructor_args(source_slither, source_creation_bytecode, source_tx_data)
    target_args = convert_args(source_args, match_relation, target_slither, deployer)
    target_tx_data = encode_target_args(target_slither, target_args)

    for testcase in testcases.values():
        testcase["transactions"][0]['input'] = '0x' + target_creation_bytecode + target_tx_data 
        testcase["transactions"][0]['to'] = ''
    return testcases

def migrate_payable_function(testcases, target_slither):
    target_selector_to_func = get_function_selectors_from_contract_instance(target_slither)
    
    for i in testcases:
        test_case = testcases[i]
        for tx in test_case['transactions']:
            if tx['value']!='0' and (len(tx['input']) >= 10 and tx['input'][:10] in target_selector_to_func and (not target_selector_to_func[tx['input'][:10]]['payable'])):
                tx['value'] = '0'
            elif tx['value']=='0' and (len(tx['input']) >= 10 and tx['input'][:10] in target_selector_to_func and (target_selector_to_func[tx['input'][:10]]['payable'])):
                tx['value'] = '100000000000000000000000'
            else:
                continue
                                
    for i in testcases:
        test_case = testcases[i]
        if not target_slither.constructor.payable:
            test_case['transactions'][0]['value'] = '0'
        else:
            test_case['transactions'][0]['value'] = '1000000000000'
                    
    return testcases



def migrate_assertions(testcases, source_slither, target_slither, source_func_to_target_func):
    target_event_to_source_event, target_event_to_function = match_events(source_slither, target_slither, source_func_to_target_func)
    source_event_to_target_event = {value: key for key, value in target_event_to_source_event.items()}
    target_selector_to_func = get_function_selectors_from_contract_instance(target_slither)
    source_selector_to_func = get_function_selectors_from_contract_instance(source_slither)
    unmatched_assertions = {}
    matched_assertions = {}
    for i in testcases:
        test_case = testcases[i]
        unmatched_assertions[i] = []
        matched_assertions[i] = []
        for tx in test_case['assertions']:
            txInfo = [txInfo for txInfo in test_case['transactions'] if txInfo['hash'] == tx][0]
            new_assertions = []
            assertions = test_case['assertions'][tx]
            for assertion in assertions:
                if assertion['method'] == 'emit':
                    short_assertion = assertion.copy()
                    short_assertion['args'] = short_assertion['args'][1:]
                    if assertion['args'][1] in source_event_to_target_event :
                        if txInfo['input'][:10] in target_selector_to_func and target_selector_to_func[txInfo['input'][:10]]['name'] in target_event_to_function[source_event_to_target_event[assertion['args'][1]]]:
                            assertion['args'][1] = source_event_to_target_event[assertion['args'][1]]
                            new_assertions.append(assertion)
                            matched_assertions[i].append((tx, short_assertion))
                        else:
                            if txInfo['input'][:10] in target_selector_to_func:
                                unmatched_assertions[i].append((tx, target_selector_to_func[txInfo['input'][:10]]['name'], short_assertion))
                            else:
                                unmatched_assertions[i].append((tx, txInfo['input'][:10], short_assertion))
                elif assertion['method'] == 'withArgs' and (len(new_assertions)==0 or new_assertions[-1]['method']!='emit'):
                    continue
                elif assertion['method'] == 'not-reverted':
                    continue
                elif assertion['method'] == 'equal':
                    if txInfo['input'][:10] in target_selector_to_func and txInfo['input'][:10] in source_selector_to_func and tuple(source_selector_to_func[txInfo['input'][:10]]['return'])!=tuple(target_selector_to_func[txInfo['input'][:10]]['return']):
                        unmatched_assertions[i].append((tx, target_selector_to_func[txInfo['input'][:10]]['name'], assertion))
                        continue
                    elif txInfo['input'][:10] in target_selector_to_func and txInfo['input'][:10] in source_selector_to_func and tuple(source_selector_to_func[txInfo['input'][:10]]['return']) == tuple(target_selector_to_func[txInfo['input'][:10]]['return']):
                        new_assertions.append(assertion)
                        matched_assertions[i].append((tx, assertion))
                else:
                    new_assertions.append(assertion)
                    matched_assertions[i].append((tx, assertion))


            if len(new_assertions) == 0:
                new_assertions.append({'method':'not-reverted', 'args':''})
                matched_assertions[i].append((tx, {'method':'not-reverted'}))
            test_case['assertions'][tx] = new_assertions.copy()
    
        
    return testcases, unmatched_assertions, matched_assertions