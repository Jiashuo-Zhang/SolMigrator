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
    "blockNumber": "6766284",
    "timeStamp": "1543095952",
    "hash": "0xdaaa0b08e0fa932ebf1ebc9ed2de9a6eb4db3f03c77e9ed937d9c9a3a49e2b81",
    "nonce": "0",
    "blockHash": "0x63baa5fa01a06cb5121871b235544d0eb7fa4e73a2d3e0c03307cbf7b3486ca5",
    "transactionIndex": "121",
    "from": "0x8b41783ad99fcbeb8d575fa7a7b5a04fa0b8d80b",
    "to": "",
    "value": "0",
    "gas": "1618080",
    "gasPrice": "10000000000",
    "isError": "0",
    "txreceipt_status": "1",
    "input": "0x60806040523480156200001157600080fd5b5060405162001c2538038062001c25833981810160405260208110156200003757600080fd5b5051604080518082018252600b81526a23b930b834102a37b5b2b760a91b60208281019182528351808501909452600384526211d49560ea1b9084015281519192916200008791600591620003a7565b5080516200009d906006906020840190620003a7565b505060078054601260ff1990911617905550620000c633620001bb602090811b62000dcd17901c565b620000d23382620001dd565b620000dd33620002f0565b7fd87cd6ef79d4e2b95e15ce8abf732db51ec771f1ca2edccf22a46c729ac564727fefcec85968da792893fa503eb21730083fc6c50ed5461e56163b28335b2a5f967f044852b2a670ade5407e78fb2863c51de9fcb96542a07186fe3aeda6bb8a116d6200014a6200033c565b6040805160208082019690965280820194909452606084019290925260808301523060a08301527f51f3d585afe6dfeb2af01bba0889a36c1db03beec88c6a4d0c53817069026afa60c0808401919091528151808403909101815260e0909201905280519101206008555062000453565b600080546001600160a01b0319166001600160a01b0392909216919091179055565b6001600160a01b03821662000239576040805162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f206164647265737300604482015290519081900360640190fd5b620002476000838362000340565b62000263816004546200034560201b62000def1790919060201c565b6004556001600160a01b0382166000908152600260209081526040909120546200029891839062000def62000345821b17901c565b6001600160a01b03831660008181526002602090815260408083209490945583518581529351929391927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9281900390910190a35050565b6001600160a01b038116600081815260096020526040808220805460ff19166001179055517f6ae172837ea30b801fbfcdd4108aa1d5bf8ff775444fd70256b44e6bf3dfc3f69190a250565b4690565b505050565b600082820183811015620003a0576040805162461bcd60e51b815260206004820152601b60248201527f536166654d6174683a206164646974696f6e206f766572666c6f770000000000604482015290519081900360640190fd5b9392505050565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282620003df57600085556200042a565b82601f10620003fa57805160ff19168380011785556200042a565b828001600101855582156200042a579182015b828111156200042a5782518255916020019190600101906200040d565b50620004389291506200043c565b5090565b5b808211156200043857600081556001016200043d565b6117c280620004636000396000f3fe608060405234801561001057600080fd5b50600436106101585760003560e01c806379cc6790116100c3578063a9059cbb1161007c578063a9059cbb1461042b578063aa271e1a14610457578063d505accf1461047d578063dd62ed3e146104ce578063e3056a34146104fc578063f2fde38b1461050457610158565b806379cc6790146103775780637ecebe00146103a357806395d89b41146103c9578063983b2d56146103d157806398650275146103f7578063a457c2d7146103ff57610158565b8063313ce56711610115578063313ce567146102b657806339509351146102d457806340c10f191461030057806342966c681461032c57806370a082311461034957806379ba50971461036f57610158565b806306fdde031461015d578063095ea7b3146101da5780630c340a241461021a57806318160ddd1461023e57806323b872dd146102585780633092afd51461028e575b600080fd5b61016561052a565b6040805160208082528351818301528351919283929083019185019080838360005b8381101561019f578181015183820152602001610187565b50505050905090810190601f1680156101cc5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b610206600480360360408110156101f057600080fd5b506001600160a01b0381351690602001356105c0565b604080519115158252519081900360200190f35b6102226105dd565b604080516001600160a01b039092168252519081900360200190f35b6102466105ec565b60408051918252519081900360200190f35b6102066004803603606081101561026e57600080fd5b506001600160a01b038135811691602081013590911690604001356105f2565b6102b4600480360360208110156102a457600080fd5b50356001600160a01b0316610679565b005b6102be6106dd565b6040805160ff9092168252519081900360200190f35b610206600480360360408110156102ea57600080fd5b506001600160a01b0381351690602001356106e6565b6102b46004803603604081101561031657600080fd5b506001600160a01b038135169060200135610734565b6102b46004803603602081101561034257600080fd5b5035610793565b6102466004803603602081101561035f57600080fd5b50356001600160a01b03166107a4565b6102b46107bf565b6102b46004803603604081101561038d57600080fd5b506001600160a01b0381351690602001356108ce565b610246600480360360208110156103b957600080fd5b50356001600160a01b0316610928565b61016561093a565b6102b4600480360360208110156103e757600080fd5b50356001600160a01b031661099b565b6102b46109fc565b6102066004803603604081101561041557600080fd5b506001600160a01b038135169060200135610a07565b6102066004803603604081101561044157600080fd5b506001600160a01b038135169060200135610a6f565b6102066004803603602081101561046d57600080fd5b50356001600160a01b0316610a83565b6102b4600480360360e081101561049357600080fd5b506001600160a01b03813581169160208101359091169060408101359060608101359060ff6080820135169060a08101359060c00135610aa1565b610246600480360360408110156104e457600080fd5b506001600160a01b0381358116916020013516610c95565b610222610cc0565b6102b46004803603602081101561051a57600080fd5b50356001600160a01b0316610ccf565b60058054604080516020601f60026000196101006001881615020190951694909404938401819004810282018101909252828152606093909290918301828280156105b65780601f1061058b576101008083540402835291602001916105b6565b820191906000526020600020905b81548152906001019060200180831161059957829003601f168201915b5050505050905090565b60006105d46105cd610e50565b8484610e54565b50600192915050565b6000546001600160a01b031681565b60045490565b60006105ff848484610f40565b61066f8461060b610e50565b61066a856040518060600160405280602881526020016116b2602891396001600160a01b038a16600090815260036020526040812090610649610e50565b6001600160a01b03168152602081019190915260400160002054919061109d565b610e54565b5060019392505050565b6000546001600160a01b031633146106d1576040805162461bcd60e51b815260206004820152601660248201527513db9b1e4811dbdd995c9b9bdc8818d85b8818d85b1b60521b604482015290519081900360640190fd5b6106da81611134565b50565b60075460ff1690565b60006105d46106f3610e50565b8461066a8560036000610704610e50565b6001600160a01b03908116825260208083019390935260409182016000908120918c168152925290205490610def565b61073d33610a83565b610785576040805162461bcd60e51b815260206004820152601460248201527313db9b1e481b5a5b9d195c8818d85b8818d85b1b60621b604482015290519081900360640190fd5b61078f828261117d565b5050565b6106da61079e610e50565b8261126f565b6001600160a01b031660009081526002602052604090205490565b6001546001600160a01b0316158015906107e357506001546001600160a01b031633145b610834576040805162461bcd60e51b815260206004820152601f60248201527f43616c6c6572206d7573742062652070656e64696e6720676f7665726e6f7200604482015290519081900360640190fd5b60008054600180546001600160a01b038082166001600160a01b03198086168217808855931690935560405193811694929391169184917f0ac6deed30eef60090c749850e10f2fa469e3e25fec1d1bef2853003f6e6f18f9190a36001546040516001600160a01b03918216918316907f76563ad561b7036ae716b9b25cb521b21463240f104c97e12f25877f2235f33d90600090a35050565b6000610905826040518060600160405280602481526020016116da602491396108fe866108f9610e50565b610c95565b919061109d565b905061091983610913610e50565b83610e54565b610923838361126f565b505050565b600a6020526000908152604090205481565b60068054604080516020601f60026000196101006001881615020190951694909404938401819004810282018101909252828152606093909290918301828280156105b65780601f1061058b576101008083540402835291602001916105b6565b6000546001600160a01b031633146109f3576040805162461bcd60e51b815260206004820152601660248201527513db9b1e4811dbdd995c9b9bdc8818d85b8818d85b1b60521b604482015290519081900360640190fd5b6106da8161136b565b610a0533611134565b565b60006105d4610a14610e50565b8461066a856040518060600160405280602581526020016117686025913960036000610a3e610e50565b6001600160a01b03908116825260208083019390935260409182016000908120918d1681529252902054919061109d565b60006105d4610a7c610e50565b8484610f40565b6001600160a01b031660009081526009602052604090205460ff1690565b6008546001600160a01b038089166000818152600a602081815260408084205481517f6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c981850152808301879052968e166060880152608087018d905260a0870181905260c08088018d90528251808903909101815260e08801835280519084012061190160f01b6101008901526101028801989098526101228088019890985281518088039098018852610142909601905285519581019590952092909152909252610b6e906001610def565b6001600160a01b0389166000908152600a602090815260408083209390935582519081018690528083018590526001600160f81b031960f888901b16606082015282516041818303018152606190910190925290610bcd9083906113b7565b9050806001600160a01b0316896001600160a01b031614610c2b576040805162461bcd60e51b815260206004820152601360248201527211d4950e881a5b9d985b1a59081c195c9b5a5d606a1b604482015290519081900360640190fd5b851580610c385750854211155b610c7f576040805162461bcd60e51b815260206004820152601360248201527211d4950e88195e1c1a5c9959081c195c9b5a5d606a1b604482015290519081900360640190fd5b610c8a898989610e54565b505050505050505050565b6001600160a01b03918216600090815260036020908152604080832093909416825291909152205490565b6001546001600160a01b031681565b6000546001600160a01b03163314610d27576040805162461bcd60e51b815260206004820152601660248201527513db9b1e4811dbdd995c9b9bdc8818d85b8818d85b1b60521b604482015290519081900360640190fd5b6001600160a01b038116610d79576040805162461bcd60e51b815260206004820152601460248201527311dbdd995c9b9bdc881b5d5cdd081899481cd95d60621b604482015290519081900360640190fd5b600180546001600160a01b038381166001600160a01b03198316179283905560405191811692169082907f76563ad561b7036ae716b9b25cb521b21463240f104c97e12f25877f2235f33d90600090a35050565b600080546001600160a01b0319166001600160a01b0392909216919091179055565b600082820183811015610e49576040805162461bcd60e51b815260206004820152601b60248201527f536166654d6174683a206164646974696f6e206f766572666c6f770000000000604482015290519081900360640190fd5b9392505050565b3390565b6001600160a01b038316610e995760405162461bcd60e51b81526004018080602001828103825260248152602001806117446024913960400191505060405180910390fd5b6001600160a01b038216610ede5760405162461bcd60e51b81526004018080602001828103825260228152602001806116266022913960400191505060405180910390fd5b6001600160a01b03808416600081815260036020908152604080832094871680845294825291829020859055815185815291517f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b9259281900390910190a3505050565b6001600160a01b038316610f855760405162461bcd60e51b815260040180806020018281038252602581526020018061171f6025913960400191505060405180910390fd5b6001600160a01b038216610fca5760405162461bcd60e51b81526004018080602001828103825260238152602001806115e16023913960400191505060405180910390fd5b610fd5838383610923565b61101281604051806060016040528060268152602001611648602691396001600160a01b038616600090815260026020526040902054919061109d565b6001600160a01b0380851660009081526002602052604080822093909355908416815220546110419082610def565b6001600160a01b0380841660008181526002602090815260409182902094909455805185815290519193928716927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef92918290030190a3505050565b6000818484111561112c5760405162461bcd60e51b81526004018080602001828103825283818151815260200191508051906020019080838360005b838110156110f15781810151838201526020016110d9565b50505050905090810190601f16801561111e5780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b505050900390565b6001600160a01b038116600081815260096020526040808220805460ff19169055517fe94479a9f7e1952cc78f2d6baab678adc1b772d936c6583def489e524cb666929190a250565b6001600160a01b0382166111d8576040805162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f206164647265737300604482015290519081900360640190fd5b6111e460008383610923565b6004546111f19082610def565b6004556001600160a01b0382166000908152600260205260409020546112179082610def565b6001600160a01b03831660008181526002602090815260408083209490945583518581529351929391927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9281900390910190a35050565b6001600160a01b0382166112b45760405162461bcd60e51b81526004018080602001828103825260218152602001806116fe6021913960400191505060405180910390fd5b6112c082600083610923565b6112fd81604051806060016040528060228152602001611604602291396001600160a01b038516600090815260026020526040902054919061109d565b6001600160a01b038316600090815260026020526040902055600454611323908261159e565b6004556040805182815290516000916001600160a01b038516917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9181900360200190a35050565b6001600160a01b038116600081815260096020526040808220805460ff19166001179055517f6ae172837ea30b801fbfcdd4108aa1d5bf8ff775444fd70256b44e6bf3dfc3f69190a250565b6000815160411461140f576040805162461bcd60e51b815260206004820152601f60248201527f45434453413a20696e76616c6964207369676e6174757265206c656e67746800604482015290519081900360640190fd5b60208201516040830151606084015160001a7f7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a08211156114805760405162461bcd60e51b815260040180806020018281038252602281526020018061166e6022913960400191505060405180910390fd5b8060ff16601b148061149557508060ff16601c145b6114d05760405162461bcd60e51b81526004018080602001828103825260228152602001806116906022913960400191505060405180910390fd5b600060018783868660405160008152602001604052604051808581526020018460ff1681526020018381526020018281526020019450505050506020604051602081039080840390855afa15801561152c573d6000803e3d6000fd5b5050604051601f1901519150506001600160a01b038116611594576040805162461bcd60e51b815260206004820152601860248201527f45434453413a20696e76616c6964207369676e61747572650000000000000000604482015290519081900360640190fd5b9695505050505050565b6000610e4983836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f77000081525061109d56fe45524332303a207472616e7366657220746f20746865207a65726f206164647265737345524332303a206275726e20616d6f756e7420657863656564732062616c616e636545524332303a20617070726f766520746f20746865207a65726f206164647265737345524332303a207472616e7366657220616d6f756e7420657863656564732062616c616e636545434453413a20696e76616c6964207369676e6174757265202773272076616c756545434453413a20696e76616c6964207369676e6174757265202776272076616c756545524332303a207472616e7366657220616d6f756e74206578636565647320616c6c6f77616e636545524332303a206275726e20616d6f756e74206578636565647320616c6c6f77616e636545524332303a206275726e2066726f6d20746865207a65726f206164647265737345524332303a207472616e736665722066726f6d20746865207a65726f206164647265737345524332303a20617070726f76652066726f6d20746865207a65726f206164647265737345524332303a2064656372656173656420616c6c6f77616e63652062656c6f77207a65726fa264697066735822122028978c229b51c3a9489101e8096301e85866fa63b6ccbd95d247e376d1f5407664736f6c6343000704003300000000000000000000000000000000019a764b45a62093c59ccdc440000000",
    "contractAddress": "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    "cumulativeGasUsed": "7194590",
    "gasUsed": "1348400",
    "confirmations": "13046359",
    "methodId": "0x60058054",
    "functionName": "",
    "trace_address": [
      -1
    ]
  },
  {
    "blockNumber": "6766296",
    "timeStamp": "1543096121",
    "hash": "0x390dba32da89f1436ef7bb9db0a37b6bbb5b71878d21eefde6dbd7b57d0fe8ad",
    "nonce": "6",
    "blockHash": "0xa9e1be5fc9b238f3b2a7a44e85e5a6622a990f2d15650dca783b769f9abc6f37",
    "transactionIndex": "53",
    "from": "0x8b41783ad99fcbeb8d575fa7a7b5a04fa0b8d80b",
    "to": "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    "value": "0",
    "gas": "600000",
    "gasPrice": "10000000000",
    "isError": "0",
    "txreceipt_status": "1",
    "input": "0xf2fde38b000000000000000000000000ca06411bd7a7296d7dbdd0050dfc846e95febeb7",
    "contractAddress": "",
    "cumulativeGasUsed": "1777599",
    "gasUsed": "44019",
    "confirmations": "13046347",
    "methodId": "0xf2fde38b",
    "functionName": "transferOwnership(address newOwner)",
    "trace_address": [
      -1
    ]
  },
  {
    "blockNumber": "6766297",
    "hash": "0x25423584547d5f849c590352f2a38de98b4475b1982041e9c35223fd1746b223_0",
    "transactionIndex": 54,
    "from": "0xca06411bd7a7296d7dbdd0050dfc846e95febeb7",
    "to": "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    "value": "0",
    "gas": "566084",
    "isError": "0",
    "input": "0x79ba5097",
    "methodId": "0x4e71e0c8",
    "trace_address": [
      0
    ],
    "isInternal": true
  }
]
const assertions = {
  "0x25423584547d5f849c590352f2a38de98b4475b1982041e9c35223fd1746b223_0": [
    {
      "method": "emit",
      "args": [
        {
          "interface": {
            "fragments": [
              {
                "constant": true,
                "inputs": [],
                "name": "mintingFinished",
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
                    "name": "_spender",
                    "type": "address"
                  },
                  {
                    "name": "_value",
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
                "constant": false,
                "inputs": [
                  {
                    "name": "_token",
                    "type": "address"
                  }
                ],
                "name": "reclaimToken",
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
                "inputs": [],
                "name": "unpause",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
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
                    "name": "_amount",
                    "type": "uint256"
                  }
                ],
                "name": "mint",
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
                "constant": false,
                "inputs": [],
                "name": "claimOwnership",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
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
                "constant": false,
                "inputs": [
                  {
                    "name": "_spender",
                    "type": "address"
                  },
                  {
                    "name": "_subtractedValue",
                    "type": "uint256"
                  }
                ],
                "name": "decreaseApproval",
                "outputs": [
                  {
                    "name": "success",
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
                    "name": "_owner",
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
                "name": "renounceOwnership",
                "outputs": [],
                "payable": false,
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "constant": false,
                "inputs": [],
                "name": "finishMinting",
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
                    "name": "_spender",
                    "type": "address"
                  },
                  {
                    "name": "_addedValue",
                    "type": "uint256"
                  }
                ],
                "name": "increaseApproval",
                "outputs": [
                  {
                    "name": "success",
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
                "name": "pendingOwner",
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
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": true,
                    "name": "burner",
                    "type": "address"
                  },
                  {
                    "indexed": false,
                    "name": "value",
                    "type": "uint256"
                  }
                ],
                "name": "Burn",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": true,
                    "name": "to",
                    "type": "address"
                  },
                  {
                    "indexed": false,
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "Mint",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [],
                "name": "MintFinished",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": true,
                    "name": "previousOwner",
                    "type": "address"
                  }
                ],
                "name": "OwnershipRenounced",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": true,
                    "name": "previousOwner",
                    "type": "address"
                  },
                  {
                    "indexed": true,
                    "name": "newOwner",
                    "type": "address"
                  }
                ],
                "name": "OwnershipTransferred",
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
              }
            ]
          }
        },
        "NewPendingOwnership"
      ]
    },
    {
      "method": "withArgs",
      "args": [
        "0x8b41783AD99FCBeB8d575fA7A7b5a04fA0b8d80b",
        "0xCA06411bd7a7296d7dbdd0050DFc846E95fEBEB7"
      ]
    }
  ],
  "0x390dba32da89f1436ef7bb9db0a37b6bbb5b71878d21eefde6dbd7b57d0fe8ad": [
    {
      "method": "not-reverted",
      "args": ""
    }
  ],
  "0xdaaa0b08e0fa932ebf1ebc9ed2de9a6eb4db3f03c77e9ed937d9c9a3a49e2b81": [
    {
      "method": "not-reverted",
      "args": ""
    }
  ]
}
