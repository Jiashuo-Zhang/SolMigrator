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
    "blockNumber": "10569013",
    "timeStamp": "1596220363",
    "hash": "0x0a4022e61c49c59b2538b78a6c7c9a0e4bb8c8fce2d1b4a725baef3c55fb7363",
    "nonce": "83",
    "blockHash": "0x678dc99c448fc2dbc10081160066b5f654c916340c79c3b239fe4aaad200dca9",
    "transactionIndex": "144",
    "from": "0xb8f226ddb7bc672e27dffb67e4adabfa8c0dfa08",
    "to": "",
    "value": "0",
    "gas": "4712388",
    "gasPrice": "49000000000",
    "isError": "0",
    "txreceipt_status": "1",
    "input": "0x606060405260008060146101000a81548160ff0219169083151502179055506000600355600060045534156200003457600080fd5b60405162002d7c38038062002d7c83398101604052808051906020019091908051820191906020018051820191906020018051906020019091905050336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550836001819055508260079080519060200190620000cf9291906200017a565b508160089080519060200190620000e89291906200017a565b508060098190555083600260008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506000600a60146101000a81548160ff0219169083151502179055505050505062000229565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10620001bd57805160ff1916838001178555620001ee565b82800160010185558215620001ee579182015b82811115620001ed578251825591602001919060010190620001d0565b5b509050620001fd919062000201565b5090565b6200022691905b808211156200022257600081600090555060010162000208565b5090565b90565b612b4380620002396000396000f300606060405260043610610196576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806306fdde031461019b5780630753c30c14610229578063095ea7b3146102625780630e136b19146102a45780630ecb93c0146102d157806318160ddd1461030a57806323b872dd1461033357806326976e3f1461039457806327e235e3146103e9578063313ce56714610436578063353907141461045f5780633eaaf86b146104885780633f4ba83a146104b157806359bf1abe146104c65780635c658165146105175780635c975abb1461058357806370a08231146105b05780638456cb59146105fd578063893d20e8146106125780638da5cb5b1461066757806395d89b41146106bc578063a9059cbb1461074a578063c0324c771461078c578063cc872b66146107b8578063db006a75146107db578063dd62ed3e146107fe578063dd644f721461086a578063e47d606014610893578063e4997dc5146108e4578063e5b5019a1461091d578063f2fde38b14610946578063f3bdc2281461097f575b600080fd5b34156101a657600080fd5b6101ae6109b8565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156101ee5780820151818401526020810190506101d3565b50505050905090810190601f16801561021b5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b341561023457600080fd5b610260600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050610a56565b005b341561026d57600080fd5b6102a2600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091908035906020019091905050610b73565b005b34156102af57600080fd5b6102b7610cc1565b604051808215151515815260200191505060405180910390f35b34156102dc57600080fd5b610308600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050610cd4565b005b341561031557600080fd5b61031d610ded565b6040518082815260200191505060405180910390f35b341561033e57600080fd5b610392600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff16906020019091908035906020019091905050610ebd565b005b341561039f57600080fd5b6103a761109d565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b34156103f457600080fd5b610420600480803573ffffffffffffffffffffffffffffffffffffffff169060200190919050506110c3565b6040518082815260200191505060405180910390f35b341561044157600080fd5b6104496110db565b6040518082815260200191505060405180910390f35b341561046a57600080fd5b6104726110e1565b6040518082815260200191505060405180910390f35b341561049357600080fd5b61049b6110e7565b6040518082815260200191505060405180910390f35b34156104bc57600080fd5b6104c46110ed565b005b34156104d157600080fd5b6104fd600480803573ffffffffffffffffffffffffffffffffffffffff169060200190919050506111ab565b604051808215151515815260200191505060405180910390f35b341561052257600080fd5b61056d600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050611201565b6040518082815260200191505060405180910390f35b341561058e57600080fd5b610596611226565b604051808215151515815260200191505060405180910390f35b34156105bb57600080fd5b6105e7600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050611239565b6040518082815260200191505060405180910390f35b341561060857600080fd5b610610611348565b005b341561061d57600080fd5b610625611408565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b341561067257600080fd5b61067a611431565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b34156106c757600080fd5b6106cf611456565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561070f5780820151818401526020810190506106f4565b50505050905090810190601f16801561073c5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b341561075557600080fd5b61078a600480803573ffffffffffffffffffffffffffffffffffffffff169060200190919080359060200190919050506114f4565b005b341561079757600080fd5b6107b6600480803590602001909190803590602001909190505061169e565b005b34156107c357600080fd5b6107d96004808035906020019091905050611783565b005b34156107e657600080fd5b6107fc600480803590602001909190505061197a565b005b341561080957600080fd5b610854600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050611b0d565b6040518082815260200191505060405180910390f35b341561087557600080fd5b61087d611c52565b6040518082815260200191505060405180910390f35b341561089e57600080fd5b6108ca600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050611c58565b604051808215151515815260200191505060405180910390f35b34156108ef57600080fd5b61091b600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050611c78565b005b341561092857600080fd5b610930611d91565b6040518082815260200191505060405180910390f35b341561095157600080fd5b61097d600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050611db5565b005b341561098a57600080fd5b6109b6600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050611e8a565b005b60078054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610a4e5780601f10610a2357610100808354040283529160200191610a4e565b820191906000526020600020905b815481529060010190602001808311610a3157829003601f168201915b505050505081565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515610ab157600080fd5b6001600a60146101000a81548160ff02191690831515021790555080600a60006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507fcc358699805e9a8b7f77b522628c7cb9abd07d9efb86b6fb616af1609036a99e81604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390a150565b604060048101600036905010151515610b8b57600080fd5b600a60149054906101000a900460ff1615610cb157600a60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663aee92d333385856040518463ffffffff167c0100000000000000000000000000000000000000000000000000000000028152600401808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018281526020019350505050600060405180830381600087803b1515610c9857600080fd5b6102c65a03f11515610ca957600080fd5b505050610cbc565b610cbb838361200e565b5b505050565b600a60149054906101000a900460ff1681565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515610d2f57600080fd5b6001600660008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548160ff0219169083151502179055507f42e160154868087d6bfdc0ca23d96a1c1cfa32f1b72ba9ba27b69b98a0d819dc81604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390a150565b6000600a60149054906101000a900460ff1615610eb457600a60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166318160ddd6000604051602001526040518163ffffffff167c0100000000000000000000000000000000000000000000000000000000028152600401602060405180830381600087803b1515610e9257600080fd5b6102c65a03f11515610ea357600080fd5b505050604051805190509050610eba565b60015490505b90565b600060149054906101000a900460ff16151515610ed957600080fd5b600660008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16151515610f3257600080fd5b600a60149054906101000a900460ff161561108c57600a60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16638b477adb338585856040518563ffffffff167c0100000000000000000000000000000000000000000000000000000000028152600401808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001828152602001945050505050600060405180830381600087803b151561107357600080fd5b6102c65a03f1151561108457600080fd5b505050611098565b6110978383836121ab565b5b505050565b600a60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60026020528060005260406000206000915090505481565b60095481565b60045481565b60015481565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614151561114857600080fd5b600060149054906101000a900460ff16151561116357600080fd5b60008060146101000a81548160ff0219169083151502179055507f7805862f689e2f13df9f062ff482ad3ad112aca9e0847911ed832e158c525b3360405160405180910390a1565b6000600660008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff169050919050565b6005602052816000526040600020602052806000526040600020600091509150505481565b600060149054906101000a900460ff1681565b6000600a60149054906101000a900460ff161561133757600a60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166370a08231836000604051602001526040518263ffffffff167c0100000000000000000000000000000000000000000000000000000000028152600401808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001915050602060405180830381600087803b151561131557600080fd5b6102c65a03f1151561132657600080fd5b505050604051805190509050611343565b61134082612652565b90505b919050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415156113a357600080fd5b600060149054906101000a900460ff161515156113bf57600080fd5b6001600060146101000a81548160ff0219169083151502179055507f6985a02210a168e66602d3235cb6db0e70f92b3ba4d376a33c0f3d9434bff62560405160405180910390a1565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60088054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156114ec5780601f106114c1576101008083540402835291602001916114ec565b820191906000526020600020905b8154815290600101906020018083116114cf57829003601f168201915b505050505081565b600060149054906101000a900460ff1615151561151057600080fd5b600660003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff1615151561156957600080fd5b600a60149054906101000a900460ff161561168f57600a60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16636e18980a3384846040518463ffffffff167c0100000000000000000000000000000000000000000000000000000000028152600401808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018281526020019350505050600060405180830381600087803b151561167657600080fd5b6102c65a03f1151561168757600080fd5b50505061169a565b611699828261269b565b5b5050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415156116f957600080fd5b60148210151561170857600080fd5b60328110151561171757600080fd5b81600381905550611736600954600a0a82612a0390919063ffffffff16565b6004819055507fb044a1e409eac5c48e5af22d4af52670dd1a99059537a78b31b48c6500a6354e600354600454604051808381526020018281526020019250505060405180910390a15050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415156117de57600080fd5b60015481600154011115156117f257600080fd5b600260008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205481600260008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054011115156118c257600080fd5b80600260008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008282540192505081905550806001600082825401925050819055507fcb8241adb0c3fdb35b70c24ce35c5eb0c17af7431c99f827d44a445ca624176a816040518082815260200191505060405180910390a150565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415156119d557600080fd5b80600154101515156119e657600080fd5b80600260008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410151515611a5557600080fd5b8060016000828254039250508190555080600260008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825403925050819055507f702d5967f45f6513a38ffc42d6ba9bf230bd40e8f53b16363c7eb4fd2deb9a44816040518082815260200191505060405180910390a150565b6000600a60149054906101000a900460ff1615611c3f57600a60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663dd62ed3e84846000604051602001526040518363ffffffff167c0100000000000000000000000000000000000000000000000000000000028152600401808373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200192505050602060405180830381600087803b1515611c1d57600080fd5b6102c65a03f11515611c2e57600080fd5b505050604051805190509050611c4c565b611c498383612a3e565b90505b92915050565b60035481565b60066020528060005260406000206000915054906101000a900460ff1681565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515611cd357600080fd5b6000600660008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548160ff0219169083151502179055507fd7e9ec6e6ecd65492dce6bf513cd6867560d49544421d0783ddf06e76c24470c81604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390a150565b7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff81565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515611e1057600080fd5b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16141515611e8757806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505b50565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515611ee757600080fd5b600660008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff161515611f3f57600080fd5b611f4882611239565b90506000600260008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550806001600082825403925050819055507f61e6e66b0d6339b2980aecc6ccc0039736791f0ccde9ed512e789a7fbdd698c68282604051808373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018281526020019250505060405180910390a15050565b60406004810160003690501015151561202657600080fd5b600082141580156120b457506000600560003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205414155b1515156120c057600080fd5b81600560003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040518082815260200191505060405180910390a3505050565b60008060006060600481016000369050101515156121c857600080fd5b600560008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054935061227061271061226260035488612a0390919063ffffffff16565b612ac590919063ffffffff16565b92506004548311156122825760045492505b7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff84101561233e576122bd8585612ae090919063ffffffff16565b600560008973ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055505b6123518386612ae090919063ffffffff16565b91506123a585600260008a73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054612ae090919063ffffffff16565b600260008973ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061243a82600260008973ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054612af990919063ffffffff16565b600260008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555060008311156125e4576124f983600260008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054612af990919063ffffffff16565b600260008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168773ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef856040518082815260200191505060405180910390a35b8573ffffffffffffffffffffffffffffffffffffffff168773ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a350505050505050565b6000600260008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b6000806040600481016000369050101515156126b657600080fd5b6126df6127106126d160035487612a0390919063ffffffff16565b612ac590919063ffffffff16565b92506004548311156126f15760045492505b6127048385612ae090919063ffffffff16565b915061275884600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054612ae090919063ffffffff16565b600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506127ed82600260008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054612af990919063ffffffff16565b600260008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506000831115612997576128ac83600260008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054612af990919063ffffffff16565b600260008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef856040518082815260200191505060405180910390a35b8473ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a35050505050565b6000806000841415612a185760009150612a37565b8284029050828482811515612a2957fe5b04141515612a3357fe5b8091505b5092915050565b6000600560008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b6000808284811515612ad357fe5b0490508091505092915050565b6000828211151515612aee57fe5b818303905092915050565b6000808284019050838110151515612b0d57fe5b80915050929150505600a165627a7a72305820645ee12d73db47fd78ba77fa1f824c3c8f9184061b3b10386beb4dc9236abb2800290000000000000000000000000000000006c7a63fff802c5be3eb5d6fc0000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000314dc6448d9338c15b0a000000000000000000000000000000000000000000000000000000000000000000000007774474445a7362000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009534849424120494e550000000000000000000000000000000000000000000000",
    "contractAddress": "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce",
    "cumulativeGasUsed": "8701105",
    "gasUsed": "1231579",
    "confirmations": "9243569",
    "methodId": "0x60806040",
    "functionName": "atInversebrah(int248 a, uint48[] b, uint32 c, bytes20[] d, bytes30[] e)",
    "trace_address": [
      -1
    ]
  },
  {
    "blockNumber": "10569584",
    "timeStamp": "1596227913",
    "hash": "0xdae574d494958c502f619808a097ec1b0803a5b2c3c1754198fa1f2cff4dce88",
    "nonce": "86",
    "blockHash": "0x92b127dee97f6c7af2aba169b2a9245ad99318d06bfeb6b9b7e5dd84edecfcd3",
    "transactionIndex": "205",
    "from": "0xb8f226ddb7bc672e27dffb67e4adabfa8c0dfa08",
    "to": "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce",
    "value": "0",
    "gas": "48896",
    "gasPrice": "42154509008",
    "isError": "0",
    "txreceipt_status": "1",
    "input": "0x095ea7b30000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488dffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "contractAddress": "",
    "cumulativeGasUsed": "9992870",
    "gasUsed": "44451",
    "confirmations": "9242998",
    "methodId": "0x095ea7b3",
    "functionName": "approve(address _spender, uint256 _value)",
    "trace_address": [
      -1
    ]
  },
  {
    "blockNumber": "10569599",
    "hash": "0x7f1be2ac40313400c83f23fbe3926bf6bf1d6b2b363264b3016444ea28fe21c7_0",
    "transactionIndex": 127,
    "from": "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
    "to": "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce",
    "value": "0",
    "gas": "506689",
    "isError": "0",
    "input": "0x23b872dd000000000000000000000000b8f226ddb7bc672e27dffb67e4adabfa8c0dfa08000000000000000000000000811beed0119b4afce20d2583eb608c6f7af1954f0000000000000000000000000000000000001867c74336b83c1807f1c0000000",
    "methodId": "0x23b872dd",
    "trace_address": [
      3
    ],
    "isInternal": true
  }
]
const assertions = {
  "0x0a4022e61c49c59b2538b78a6c7c9a0e4bb8c8fce2d1b4a725baef3c55fb7363": [
    {
      "method": "not-reverted",
      "args": ""
    }
  ],
  "0x7f1be2ac40313400c83f23fbe3926bf6bf1d6b2b363264b3016444ea28fe21c7_0": [
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
                    "name": "spender",
                    "type": "address"
                  },
                  {
                    "name": "value",
                    "type": "uint256"
                  }
                ],
                "name": "approve",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
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
                    "name": "sender",
                    "type": "address"
                  },
                  {
                    "name": "recipient",
                    "type": "address"
                  },
                  {
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "transferFrom",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "decimals",
                "outputs": [
                  {
                    "name": "",
                    "type": "uint8"
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
                    "name": "spender",
                    "type": "address"
                  },
                  {
                    "name": "addedValue",
                    "type": "uint256"
                  }
                ],
                "name": "increaseAllowance",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "value",
                    "type": "uint256"
                  }
                ],
                "name": "burn",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [
                  {
                    "name": "account",
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
                    "name": "spender",
                    "type": "address"
                  },
                  {
                    "name": "subtractedValue",
                    "type": "uint256"
                  }
                ],
                "name": "decreaseAllowance",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "recipient",
                    "type": "address"
                  },
                  {
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "transfer",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [
                  {
                    "name": "owner",
                    "type": "address"
                  },
                  {
                    "name": "spender",
                    "type": "address"
                  }
                ],
                "name": "allowance",
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
                "inputs": [
                  {
                    "name": "name",
                    "type": "string"
                  },
                  {
                    "name": "symbol",
                    "type": "string"
                  },
                  {
                    "name": "decimals",
                    "type": "uint8"
                  },
                  {
                    "name": "totalSupply",
                    "type": "uint256"
                  },
                  {
                    "name": "feeReceiver",
                    "type": "address"
                  },
                  {
                    "name": "tokenOwnerAddress",
                    "type": "address"
                  }
                ],
                "payable": true,
                "stateMutability": "payable",
                "type": "constructor"
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
              }
            ]
          }
        },
        "Transfer"
      ]
    },
    {
      "method": "withArgs",
      "args": [
        "0xB8f226dDb7bC672E27dffB67e4adAbFa8c0dFA08",
        "0x811beEd0119b4AfCE20D2583EB608C6F7AF1954f",
        "0x1867c74336b83c1807f1c0000000"
      ]
    }
  ],
  "0xdae574d494958c502f619808a097ec1b0803a5b2c3c1754198fa1f2cff4dce88": [
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
                    "name": "spender",
                    "type": "address"
                  },
                  {
                    "name": "value",
                    "type": "uint256"
                  }
                ],
                "name": "approve",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
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
                    "name": "sender",
                    "type": "address"
                  },
                  {
                    "name": "recipient",
                    "type": "address"
                  },
                  {
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "transferFrom",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [],
                "name": "decimals",
                "outputs": [
                  {
                    "name": "",
                    "type": "uint8"
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
                    "name": "spender",
                    "type": "address"
                  },
                  {
                    "name": "addedValue",
                    "type": "uint256"
                  }
                ],
                "name": "increaseAllowance",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "value",
                    "type": "uint256"
                  }
                ],
                "name": "burn",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [
                  {
                    "name": "account",
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
                    "name": "spender",
                    "type": "address"
                  },
                  {
                    "name": "subtractedValue",
                    "type": "uint256"
                  }
                ],
                "name": "decreaseAllowance",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [
                  {
                    "name": "recipient",
                    "type": "address"
                  },
                  {
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "transfer",
                "outputs": [
                  {
                    "name": "",
                    "type": "bool"
                  }
                ],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": true,
                "inputs": [
                  {
                    "name": "owner",
                    "type": "address"
                  },
                  {
                    "name": "spender",
                    "type": "address"
                  }
                ],
                "name": "allowance",
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
                "inputs": [
                  {
                    "name": "name",
                    "type": "string"
                  },
                  {
                    "name": "symbol",
                    "type": "string"
                  },
                  {
                    "name": "decimals",
                    "type": "uint8"
                  },
                  {
                    "name": "totalSupply",
                    "type": "uint256"
                  },
                  {
                    "name": "feeReceiver",
                    "type": "address"
                  },
                  {
                    "name": "tokenOwnerAddress",
                    "type": "address"
                  }
                ],
                "payable": true,
                "stateMutability": "payable",
                "type": "constructor"
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
        "0xB8f226dDb7bC672E27dffB67e4adAbFa8c0dFA08",
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      ]
    }
  ]
}
