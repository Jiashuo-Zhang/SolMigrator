const { expect } = require("chai");
require("@nomiclabs/hardhat-ethers");
const { ethers } = require('hardhat');
const { Contract } = require("ethers");
const { mine } = require('@nomicfoundation/hardhat-network-helpers');
require("@nomicfoundation/hardhat-chai-matchers");
const path = require('path');
const fs = require('fs');

function saveTrace(txHash, trace) {
    const traceDir = path.join(__dirname, '..', 'trace');
    if (!fs.existsSync(traceDir)) {
        fs.mkdirSync(traceDir, { recursive: true });
    }
    const filePath = path.join(traceDir, `${txHash}.json`);
    fs.writeFileSync(filePath, JSON.stringify(trace, null, 2));
}


describe("test", function () {
  it("Should execute all transactions", async function () {
    let contractAddress = undefined;
    let results = [];  

    for (const tx of transactions) {
      let txResultEntry = { hash: tx.hash, pass_assertion: false, revert: false, revert_reason: '', failed_assertion: [], checked_assertion: [], assertion_fail_reason: ''};

      
      if (tx.from) {
        await network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [tx.from],
        });
        await ethers.provider.send("hardhat_setBalance", [tx.from, "0x3635C9ADC5DEA000000000000000"]);  
      }
      
      

      const signer = await ethers.getSigner(tx.from);
      let gas = Number(tx.gas)
      if (tx.isError == '0') {
          gas = gas + 10000000
      }
      const transaction = {
          to: contractAddress,
          value: tx.value, 
          gasLimit: 90000000,
          gasPrice: 8000000000,
          data: tx.input
      };          
      console.log("Sending Tx to", contractAddress)
      
        let txResult;
        let txHash;
        let txReceipt;

        try {
            
            txResult =  signer.sendTransaction(transaction);
            txHash = (await txResult).hash
            txReceipt = await (await txResult).wait();  
            if (txReceipt.contractAddress) {
              contractAddress = txReceipt.contractAddress
              console.log("Deployed Contract At", contractAddress)
            }
            
            
            
            
            
              txResultEntry.revert = false;
              console.log("Transaction Succeeded?", txReceipt.status == 1, tx.hash)

        } catch (error) {
            txResultEntry.revert = true;
            txResultEntry.revert_reason = error.message;
            if (error.transactionHash) {
                
                txHash = error.transactionHash;
                
                txReceipt = await ethers.provider.getTransactionReceipt(txHash);
            }
            console.log("Transaction Reverted", error, tx.hash)
        }
        let trace;
        if (txHash) {
          trace = await network.provider.send("debug_traceTransaction", [txHash]);
          
        }
        
        console.log("Executing Tx:", tx.hash)
        if (assertions[tx.hash]) {
          let assertionChain = expect(txResult);
          let contract;
          try{
          for (const assertion of assertions[tx.hash]) {
              txResultEntry.checked_assertion.push(assertion['method'])
              console.log("Checking assertion:", assertion['method'])
              switch (assertion['method']) {
                  case "revertedWithCustomError":
                      contract = new Contract(contractAddress, assertion.args[0]['interface']['fragments'], signer);
                      assertionChain = assertionChain.to.be.revertedWithCustomError(contract, assertion.args[1]);
                      break;
                  case "revertedWithPanic":
                      assertionChain = assertionChain.to.be.revertedWithCustomError(...assertion.args);
                      break;
                  case "reverted":
                      assertionChain = assertionChain.to.be.reverted;
                      break;
                  case "not-reverted":
                      assertionChain = assertionChain.to.not.be.reverted;
                      break;
                  case "equal":
                      expect(trace['returnValue']).to.equal(assertion.args);
                      break;
                  case "changeTokenBalance":
                      contract = new Contract(contractAddress, assertion.args[0]['interface']['fragments'], signer);
                      assertionChain = assertionChain.to.changeTokenBalance(contract, assertion.args[1], assertion.args[2]);
                      break;
                  case "withArgs":
                      assertionChain = assertionChain.withArgs(...assertion.args);
                      break;
                  case "emit":
                    contract = new Contract(contractAddress, assertion.args[0]['interface']['fragments'], signer);
                      assertionChain = assertionChain.to.emit(contract, assertion.args[1]);
                      break;
                  case "not-emit":
                      contract = new Contract(contractAddress, assertion.args[0]['interface']['fragments'], signer);
                      assertionChain = assertionChain.to.not.emit(contract, assertion.args[1]);
                      break;
                  default:
                    console.log("Unhandled Assertion", assertion['method'])
                    break;
                  
                }
            }
          await assertionChain;
          txResultEntry.pass_assertion = true;
          } catch(error) {
              for (const assertion of assertions[tx.hash]) {
                if (assertion['method']=='emit'){
                  assertion['args'].shift()
                }
                txResultEntry.failed_assertion.push(assertion)
              }
              txResultEntry.assertion_fail_reason = error.message;
          }
          results.push(txResultEntry);

          }
    

    }
    let success = true;
    for (const result of results) {
        if (result.pass_assertion){
          continue
        } else{
          success = false;
        }
    }
    let partial_success = results[results.length - 1].pass_assertion;

    let fileName = ''
    if (success) {
    
    fileName = path.basename(__filename, path.extname(__filename)) + ".success" + ".json";
    } else if (partial_success) {
      fileName = path.basename(__filename, path.extname(__filename)) + ".partial_success" +  ".json";
    } else {
      fileName = path.basename(__filename, path.extname(__filename)) + ".fail" + ".json";
    }
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  });
});

const transactions = [
  {
    "blockNumber": "4634748",
    "timeStamp": "1511829681",
    "hash": "0x2f1c5c2b44f771e942a8506148e256f94f1a464babc938ae0690c6e34cd79190",
    "nonce": "6",
    "blockHash": "0x1420761dbff0321c42a4bda163af2d7500d723b0139a72267c009d0eedfa9e6f",
    "transactionIndex": "64",
    "from": "0x36928500bc1dcd7af6a2b4008875cc336b927d57",
    "to": "",
    "value": "1000000000000",
    "gas": "3170794",
    "gasPrice": "4000000000",
    "isError": "0",
    "txreceipt_status": "1",
    "input": "0x6080604052604051620017d4380380620017d4833981018060405260c08110156200002957600080fd5b8101908080516401000000008111156200004257600080fd5b828101905060208101848111156200005957600080fd5b81518560018202830111640100000000821117156200007757600080fd5b505092919060200180516401000000008111156200009457600080fd5b82810190506020810184811115620000ab57600080fd5b8151856001820283011164010000000082111715620000c957600080fd5b50509291906020018051906020019092919080519060200190929190805190602001909291908051906020019092919050505085600390805190602001906200011492919062000421565b5084600490805190602001906200012d92919062000421565b5083600560006101000a81548160ff021916908360ff160217905550620001648184620001b8640100000000026401000000009004565b8173ffffffffffffffffffffffffffffffffffffffff166108fc349081150290604051600060405180830381858888f19350505050158015620001ab573d6000803e3d6000fd5b50505050505050620004d0565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16141515156200025e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601f8152602001807f45524332303a206d696e7420746f20746865207a65726f20616464726573730081525060200191505060405180910390fd5b620002838160025462000396640100000000026200105b179091906401000000009004565b600281905550620002ea816000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205462000396640100000000026200105b179091906401000000009004565b6000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040518082815260200191505060405180910390a35050565b600080828401905083811015151562000417576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f536166654d6174683a206164646974696f6e206f766572666c6f77000000000081525060200191505060405180910390fd5b8091505092915050565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106200046457805160ff191683800117855562000495565b8280016001018555821562000495579182015b828111156200049457825182559160200191906001019062000477565b5b509050620004a49190620004a8565b5090565b620004cd91905b80821115620004c9576000816000905550600101620004af565b5090565b90565b6112f480620004e06000396000f3fe6080604052600436106100ba576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806306fdde03146100bf578063095ea7b31461014f57806318160ddd146101c257806323b872dd146101ed578063313ce5671461028057806339509351146102b157806342966c681461032457806370a082311461035f57806395d89b41146103c4578063a457c2d714610454578063a9059cbb146104c7578063dd62ed3e1461053a575b600080fd5b3480156100cb57600080fd5b506100d46105bf565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156101145780820151818401526020810190506100f9565b50505050905090810190601f1680156101415780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34801561015b57600080fd5b506101a86004803603604081101561017257600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610661565b604051808215151515815260200191505060405180910390f35b3480156101ce57600080fd5b506101d7610678565b6040518082815260200191505060405180910390f35b3480156101f957600080fd5b506102666004803603606081101561021057600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610682565b604051808215151515815260200191505060405180910390f35b34801561028c57600080fd5b50610295610733565b604051808260ff1660ff16815260200191505060405180910390f35b3480156102bd57600080fd5b5061030a600480360360408110156102d457600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035906020019092919050505061074a565b604051808215151515815260200191505060405180910390f35b34801561033057600080fd5b5061035d6004803603602081101561034757600080fd5b81019080803590602001909291905050506107ef565b005b34801561036b57600080fd5b506103ae6004803603602081101561038257600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506107fc565b6040518082815260200191505060405180910390f35b3480156103d057600080fd5b506103d9610844565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156104195780820151818401526020810190506103fe565b50505050905090810190601f1680156104465780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34801561046057600080fd5b506104ad6004803603604081101561047757600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506108e6565b604051808215151515815260200191505060405180910390f35b3480156104d357600080fd5b50610520600480360360408110156104ea57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035906020019092919050505061098b565b604051808215151515815260200191505060405180910390f35b34801561054657600080fd5b506105a96004803603604081101561055d57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506109a2565b6040518082815260200191505060405180910390f35b606060038054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156106575780601f1061062c57610100808354040283529160200191610657565b820191906000526020600020905b81548152906001019060200180831161063a57829003601f168201915b5050505050905090565b600061066e338484610a29565b6001905092915050565b6000600254905090565b600061068f848484610caa565b610728843361072385600160008a73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610fd090919063ffffffff16565b610a29565b600190509392505050565b6000600560009054906101000a900460ff16905090565b60006107e533846107e085600160003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008973ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461105b90919063ffffffff16565b610a29565b6001905092915050565b6107f933826110e5565b50565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b606060048054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156108dc5780601f106108b1576101008083540402835291602001916108dc565b820191906000526020600020905b8154815290600101906020018083116108bf57829003601f168201915b5050505050905090565b6000610981338461097c85600160003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008973ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610fd090919063ffffffff16565b610a29565b6001905092915050565b6000610998338484610caa565b6001905092915050565b6000600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1614151515610af4576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260248152602001807f45524332303a20617070726f76652066726f6d20746865207a65726f2061646481526020017f726573730000000000000000000000000000000000000000000000000000000081525060400191505060405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614151515610bbf576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001807f45524332303a20617070726f766520746f20746865207a65726f20616464726581526020017f737300000000000000000000000000000000000000000000000000000000000081525060400191505060405180910390fd5b80600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925836040518082815260200191505060405180910390a3505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1614151515610d75576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260258152602001807f45524332303a207472616e736665722066726f6d20746865207a65726f20616481526020017f647265737300000000000000000000000000000000000000000000000000000081525060400191505060405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614151515610e40576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260238152602001807f45524332303a207472616e7366657220746f20746865207a65726f206164647281526020017f657373000000000000000000000000000000000000000000000000000000000081525060400191505060405180910390fd5b610e91816000808673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610fd090919063ffffffff16565b6000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550610f24816000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461105b90919063ffffffff16565b6000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040518082815260200191505060405180910390a3505050565b600082821115151561104a576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601e8152602001807f536166654d6174683a207375627472616374696f6e206f766572666c6f77000081525060200191505060405180910390fd5b600082840390508091505092915050565b60008082840190508381101515156110db576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f536166654d6174683a206164646974696f6e206f766572666c6f77000000000081525060200191505060405180910390fd5b8091505092915050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16141515156111b0576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260218152602001807f45524332303a206275726e2066726f6d20746865207a65726f2061646472657381526020017f730000000000000000000000000000000000000000000000000000000000000081525060400191505060405180910390fd5b6111c581600254610fd090919063ffffffff16565b60028190555061121c816000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610fd090919063ffffffff16565b6000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040518082815260200191505060405180910390a3505056fea165627a7a72305820e20d925751f78a8e97575d042cae5a0688546f17e3e28665288efb94861651f1002900000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000174876e80000000000000000000000000036928500bc1dcd7af6a2b4008875cc336b927d5700000000000000000000000036928500bc1dcd7af6a2b4008875cc336b927d5700000000000000000000000000000000000000000000000000000000000000016a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a5465746865722055534400000000000000000000000000000000000000000000",
    "contractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "cumulativeGasUsed": "5915176",
    "gasUsed": "3170794",
    "confirmations": "15190490",
    "methodId": "0x60606040",
    "functionName": "",
    "trace_address": [
      -1
    ]
  },
  {
    "blockNumber": "4957930",
    "timeStamp": "1516708141",
    "hash": "0x42767aedf473aea4b58ad8b808287b423312878b1c1816f7e56d41314f1ce99b",
    "nonce": "115",
    "blockHash": "0x5fd7af8227f7c538859c305c1a4135d752e77574d2382442020c7a02b5f4d528",
    "transactionIndex": "127",
    "from": "0x14d06788090769f669427b6aea1c0240d2321f34",
    "to": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "value": "0",
    "gas": "69325",
    "gasPrice": "1000000000",
    "isError": "0",
    "txreceipt_status": "1",
    "input": "0x095ea7b300000000000000000000000061e2523f3e7895670be632600bf0d139453642f70000000000000000000000000000000000000000000000000000000002faf080",
    "contractAddress": "",
    "cumulativeGasUsed": "7930944",
    "gasUsed": "46217",
    "confirmations": "14867308",
    "methodId": "0x095ea7b3",
    "functionName": "approve(address _spender, uint256 _value)",
    "trace_address": [
      -1
    ]
  }
]
const assertions = {
  "0x2f1c5c2b44f771e942a8506148e256f94f1a464babc938ae0690c6e34cd79190": [
    {
      "method": "not-reverted",
      "args": ""
    }
  ],
  "0x42767aedf473aea4b58ad8b808287b423312878b1c1816f7e56d41314f1ce99b": [
    {
      "method": "emit",
      "args": [
        {
          "interface": {
            "fragments": [
              {
                "constant": true,
                "inputs": [],
                "name": "name",
                "outputs": [
                  {
                    "name": "",
                    "type": "string"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "_upgradedAddress",
                    "type": "address"
                  }
                ],
                "name": "deprecate",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "_spender",
                    "type": "address"
                  },
                  {
                    "name": "_value",
                    "type": "uint256"
                  }
                ],
                "name": "approve",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "deprecated",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "_evilUser",
                    "type": "address"
                  }
                ],
                "name": "addBlackList",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "totalSupply",
                "outputs": [
                  {
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "_from",
                    "type": "address"
                  },
                  {
                    "name": "_to",
                    "type": "address"
                  },
                  {
                    "name": "_value",
                    "type": "uint256"
                  }
                ],
                "name": "transferFrom",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "upgradedAddress",
                "outputs": [
                  {
                    "name": "",
                    "type": "address"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [
                  {
                    "name": "",
                    "type": "address"
                  }
                ],
                "name": "balances",
                "outputs": [
                  {
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "decimals",
                "outputs": [
                  {
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "maximumFee",
                "outputs": [
                  {
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "_totalSupply",
                "outputs": [
                  {
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [],
                "name": "unpause",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [
                  {
                    "name": "_maker",
                    "type": "address"
                  }
                ],
                "name": "getBlackListStatus",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [
                  {
                    "name": "",
                    "type": "address"
                  },
                  {
                    "name": "",
                    "type": "address"
                  }
                ],
                "name": "allowed",
                "outputs": [
                  {
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "paused",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [
                  {
                    "name": "who",
                    "type": "address"
                  }
                ],
                "name": "balanceOf",
                "outputs": [
                  {
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [],
                "name": "pause",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "getOwner",
                "outputs": [
                  {
                    "name": "",
                    "type": "address"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "owner",
                "outputs": [
                  {
                    "name": "",
                    "type": "address"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "symbol",
                "outputs": [
                  {
                    "name": "",
                    "type": "string"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "_to",
                    "type": "address"
                  },
                  {
                    "name": "_value",
                    "type": "uint256"
                  }
                ],
                "name": "transfer",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "newBasisPoints",
                    "type": "uint256"
                  },
                  {
                    "name": "newMaxFee",
                    "type": "uint256"
                  }
                ],
                "name": "setParams",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "issue",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "redeem",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [
                  {
                    "name": "_owner",
                    "type": "address"
                  },
                  {
                    "name": "_spender",
                    "type": "address"
                  }
                ],
                "name": "allowance",
                "outputs": [
                  {
                    "name": "remaining",
                    "type": "uint256"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "basisPointsRate",
                "outputs": [
                  {
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [
                  {
                    "name": "",
                    "type": "address"
                  }
                ],
                "name": "isBlackListed",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "_clearedUser",
                    "type": "address"
                  }
                ],
                "name": "removeBlackList",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "MAX_UINT",
                "outputs": [
                  {
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "payable": false,
                "stateMutability": "view",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "newOwner",
                    "type": "address"
                  }
                ],
                "name": "transferOwnership",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "_blackListedUser",
                    "type": "address"
                  }
                ],
                "name": "destroyBlackFunds",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "name": "_initialSupply",
                    "type": "uint256"
                  },
                  {
                    "name": "_name",
                    "type": "string"
                  },
                  {
                    "name": "_symbol",
                    "type": "string"
                  },
                  {
                    "name": "_decimals",
                    "type": "uint256"
                  }
                ],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "constructor"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": false,
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "Issue",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": false,
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "Redeem",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": false,
                    "name": "newAddress",
                    "type": "address"
                  }
                ],
                "name": "Deprecate",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": false,
                    "name": "feeBasisPoints",
                    "type": "uint256"
                  },
                  {
                    "indexed": false,
                    "name": "maxFee",
                    "type": "uint256"
                  }
                ],
                "name": "Params",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": false,
                    "name": "_blackListedUser",
                    "type": "address"
                  },
                  {
                    "indexed": false,
                    "name": "_balance",
                    "type": "uint256"
                  }
                ],
                "name": "DestroyedBlackFunds",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": false,
                    "name": "_user",
                    "type": "address"
                  }
                ],
                "name": "AddedBlackList",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": false,
                    "name": "_user",
                    "type": "address"
                  }
                ],
                "name": "RemovedBlackList",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": true,
                    "name": "owner",
                    "type": "address"
                  },
                  {
                    "indexed": true,
                    "name": "spender",
                    "type": "address"
                  },
                  {
                    "indexed": false,
                    "name": "value",
                    "type": "uint256"
                  }
                ],
                "name": "Approval",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": true,
                    "name": "from",
                    "type": "address"
                  },
                  {
                    "indexed": true,
                    "name": "to",
                    "type": "address"
                  },
                  {
                    "indexed": false,
                    "name": "value",
                    "type": "uint256"
                  }
                ],
                "name": "Transfer",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [],
                "name": "Pause",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [],
                "name": "Unpause",
                "type": "event"
              }
            ]
          }
        },
        "Approval"
      ]
    },
    {
      "method": "withArgs",
      "args": [
        "0x14d06788090769F669427B6AEA1c0240d2321f34",
        "0x61e2523F3e7895670BE632600bf0D139453642F7",
        "0x2faf080"
      ]
    }
  ]
}