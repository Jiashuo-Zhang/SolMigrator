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
    "blockNumber": "13415141",
    "timeStamp": "1634198360",
    "hash": "0xafe9777c91eb0ca07c0e2455ff739ba02758e896684346b98f3892717fd91d9c",
    "nonce": "0",
    "blockHash": "0x2319dd564c8077498d085cb81ad0a8753d4e22a1005ef15072b0078688dcf8d9",
    "transactionIndex": "187",
    "from": "0xe9df50db94a4c0b75d0df9a768a37a935c201d05",
    "to": "",
    "value": "0",
    "gas": "1067948",
    "gasPrice": "95000000000",
    "isError": "0",
    "txreceipt_status": "1",
    "input": "0x60806040526008805460ff191690553480156200001b57600080fd5b50604051620022bd380380620022bd833981810160405260408110156200004157600080fd5b81019080805160405193929190846401000000008211156200006257600080fd5b9083019060208201858111156200007857600080fd5b82516401000000008111828201881017156200009357600080fd5b82525081516020918201929091019080838360005b83811015620000c2578181015183820152602001620000a8565b50505050905090810190601f168015620000f05780820380516001836020036101000a031916815260200191505b50604052602001805160405193929190846401000000008211156200011457600080fd5b9083019060208201858111156200012a57600080fd5b82516401000000008111828201881017156200014557600080fd5b82525081516020918201929091019080838360005b83811015620001745781810151838201526020016200015a565b50505050905090810190601f168015620001a25780820380516001836020036101000a031916815260200191505b50604052505082518391508290620001c29060039060208501906200060c565b508051620001d89060049060208401906200060c565b50506005805460ff19166006179055506040805180820190915260038152620a8a4b60eb1b602082015262000216906001600160e01b036200027e16565b604080516d5052454449434154455f524f4c4560901b8152905190819003600e0190206200026290739277a463a508f45115fdeaf22ffeda1b163524336001600160e01b036200032416565b62000276826001600160e01b036200033916565b5050620006ae565b806040516020018082805190602001908083835b60208310620002b35780518252601f19909201916020918201910162000292565b51815160209384036101000a60001901801990921691161790527f3a20494e53554646494349454e545f5045524d495353494f4e530000000000009190930190815260408051808303600519018152601a909201905280516200032095506007945092019190506200060c565b5050565b6200032082826001600160e01b03620003a716565b60085460ff161562000383576040805162461bcd60e51b815260206004820152600e60248201526d185b1c9958591e481a5b9a5d195960921b604482015290519081900360640190fd5b62000397816001600160e01b036200042b16565b506008805460ff19166001179055565b6000828152600660209081526040909120620003ce9183906200175c620004f3821b17901c565b156200032057620003e76001600160e01b036200051c16565b6001600160a01b0316816001600160a01b0316837f2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d60405160405180910390a45050565b6040518060800160405280604f81526020016200226e604f913980516020918201208251838301206040805180820190915260018152603160f81b930192909252907fc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc630620004a26001600160e01b036200053916565b604080516020808201979097528082019590955260608501939093526001600160a01b03909116608084015260a0808401919091528151808403909101815260c09092019052805191012060095550565b600062000513836001600160a01b0384166001600160e01b036200053d16565b90505b92915050565b6000620005336200059560201b620016261760201c565b90505b90565b4690565b60006200055483836001600160e01b03620005f416565b6200058c5750815460018181018455600084815260208082209093018490558454848252828601909352604090209190915562000516565b50600062000516565b600033301415620005ef5760606000368080601f0160208091040260200160405190810160405280939291908181526020018383808284376000920191909152505050503601516001600160a01b03169150620005369050565b503390565b60009081526001919091016020526040902054151590565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106200064f57805160ff19168380011785556200067f565b828001600101855582156200067f579182015b828111156200067f57825182559160200191906001019062000662565b506200068d92915062000691565b5090565b6200053691905b808211156200068d576000815560010162000698565b611bb080620006be6000396000f3fe6080604052600436106101815760003560e01c806339509351116100d1578063a217fddf1161008a578063ca15c87311610064578063ca15c8731461068c578063d547741f146106b6578063dd62ed3e146106ef578063e72db5fd1461072a57610181565b8063a217fddf14610605578063a457c2d71461061a578063a9059cbb1461065357610181565b806339509351146104c657806340c10f19146104ff57806370a08231146105385780639010d07c1461056b57806391d14854146105b757806395d89b41146105f057610181565b806323b872dd1161013e5780632f2ff15d116101185780632f2ff15d14610412578063313ce5671461044d5780633408e4701461047857806336568abe1461048d57610181565b806323b872dd14610372578063248a9ca3146103b55780632d0335ab146103df57610181565b806306fdde0314610186578063095ea7b3146102105780630c53c51c1461025d5780630f7e59701461032157806318160ddd1461033657806320379ee51461035d575b600080fd5b34801561019257600080fd5b5061019b61073f565b6040805160208082528351818301528351919283929083019185019080838360005b838110156101d55781810151838201526020016101bd565b50505050905090810190601f1680156102025780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34801561021c57600080fd5b506102496004803603604081101561023357600080fd5b506001600160a01b0381351690602001356107d5565b604080519115158252519081900360200190f35b61019b600480360360a081101561027357600080fd5b6001600160a01b03823516919081019060408101602082013564010000000081111561029e57600080fd5b8201836020820111156102b057600080fd5b803590602001918460018302840111640100000000831117156102d257600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600092019190915250929550508235935050506020810135906040013560ff166107f3565b34801561032d57600080fd5b5061019b610af6565b34801561034257600080fd5b5061034b610b13565b60408051918252519081900360200190f35b34801561036957600080fd5b5061034b610b19565b34801561037e57600080fd5b506102496004803603606081101561039557600080fd5b506001600160a01b03813581169160208101359091169060400135610b1f565b3480156103c157600080fd5b5061034b600480360360208110156103d857600080fd5b5035610bac565b3480156103eb57600080fd5b5061034b6004803603602081101561040257600080fd5b50356001600160a01b0316610bc1565b34801561041e57600080fd5b5061044b6004803603604081101561043557600080fd5b50803590602001356001600160a01b0316610bdc565b005b34801561045957600080fd5b50610462610c48565b6040805160ff9092168252519081900360200190f35b34801561048457600080fd5b5061034b610c51565b34801561049957600080fd5b5061044b600480360360408110156104b057600080fd5b50803590602001356001600160a01b0316610c55565b3480156104d257600080fd5b50610249600480360360408110156104e957600080fd5b506001600160a01b038135169060200135610cb6565b34801561050b57600080fd5b5061044b6004803603604081101561052257600080fd5b506001600160a01b038135169060200135610d0a565b34801561054457600080fd5b5061034b6004803603602081101561055b57600080fd5b50356001600160a01b0316610de9565b34801561057757600080fd5b5061059b6004803603604081101561058e57600080fd5b5080359060200135610e04565b604080516001600160a01b039092168252519081900360200190f35b3480156105c357600080fd5b50610249600480360360408110156105da57600080fd5b50803590602001356001600160a01b0316610e29565b3480156105fc57600080fd5b5061019b610e47565b34801561061157600080fd5b5061034b610ea8565b34801561062657600080fd5b506102496004803603604081101561063d57600080fd5b506001600160a01b038135169060200135610ead565b34801561065f57600080fd5b506102496004803603604081101561067657600080fd5b506001600160a01b038135169060200135610f1b565b34801561069857600080fd5b5061034b600480360360208110156106af57600080fd5b5035610f2f565b3480156106c257600080fd5b5061044b600480360360408110156106d957600080fd5b50803590602001356001600160a01b0316610f46565b3480156106fb57600080fd5b5061034b6004803603604081101561071257600080fd5b506001600160a01b0381358116916020013516610f9f565b34801561073657600080fd5b5061034b610fca565b60038054604080516020601f60026000196101006001881615020190951694909404938401819004810282018101909252828152606093909290918301828280156107cb5780601f106107a0576101008083540402835291602001916107cb565b820191906000526020600020905b8154815290600101906020018083116107ae57829003601f168201915b5050505050905090565b60006107e96107e2610ff0565b8484610fff565b5060015b92915050565b60606107fd611916565b50604080516060810182526001600160a01b0388166000818152600a60209081529084902054835282015290810186905261083b87828787876110eb565b6108765760405162461bcd60e51b8152600401808060200182810382526021815260200180611abd6021913960400191505060405180910390fd5b6001600160a01b0387166000908152600a60205260409020546108a090600163ffffffff6111c816565b6001600160a01b0388166000818152600a602090815260408083209490945583519283523383820181905260609484018581528b51958501959095528a517f5845892132946850460bff5a0083f71031bc5bf9aadcd40f1de79423eac9b10b958d9592948d94919260808501928601918190849084905b8381101561092f578181015183820152602001610917565b50505050905090810190601f16801561095c5780820380516001836020036101000a031916815260200191505b5094505050505060405180910390a160006060306001600160a01b0316888a6040516020018083805190602001908083835b602083106109ad5780518252601f19909201916020918201910161098e565b6001836020036101000a038019825116818451168082178552505050505050905001826001600160a01b03166001600160a01b031660601b8152601401925050506040516020818303038152906040526040518082805190602001908083835b60208310610a2c5780518252601f199092019160209182019101610a0d565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d8060008114610a8e576040519150601f19603f3d011682016040523d82523d6000602084013e610a93565b606091505b509150915081610aea576040805162461bcd60e51b815260206004820152601c60248201527f46756e6374696f6e2063616c6c206e6f74207375636365737366756c00000000604482015290519081900360640190fd5b98975050505050505050565b604051806040016040528060018152602001603160f81b81525081565b60025490565b60095490565b6000610b2c848484611222565b610ba284610b38610ff0565b610b9d85604051806060016040528060288152602001611a95602891396001600160a01b038a16600090815260016020526040812090610b76610ff0565b6001600160a01b03168152602081019190915260400160002054919063ffffffff61138916565b610fff565b5060019392505050565b60009081526006602052604090206002015490565b6001600160a01b03166000908152600a602052604090205490565b600082815260066020526040902060020154610bff90610bfa610ff0565b610e29565b610c3a5760405162461bcd60e51b815260040180806020018281038252602f815260200180611986602f913960400191505060405180910390fd5b610c448282611420565b5050565b60055460ff1690565b4690565b610c5d610ff0565b6001600160a01b0316816001600160a01b031614610cac5760405162461bcd60e51b815260040180806020018281038252602f815260200180611b4c602f913960400191505060405180910390fd5b610c44828261148f565b60006107e9610cc3610ff0565b84610b9d8560016000610cd4610ff0565b6001600160a01b03908116825260208083019390935260409182016000908120918c16815292529020549063ffffffff6111c816565b604080516d5052454449434154455f524f4c4560901b8152905190819003600e019020610d3981610bfa610ff0565b600790610dd95760405162461bcd60e51b8152602060048201908152825460026000196101006001841615020190911604602483018190529091829160449091019084908015610dca5780601f10610d9f57610100808354040283529160200191610dca565b820191906000526020600020905b815481529060010190602001808311610dad57829003601f168201915b50509250505060405180910390fd5b50610de483836114fe565b505050565b6001600160a01b031660009081526020819052604090205490565b6000828152600660205260408120610e22908363ffffffff6115fa16565b9392505050565b6000828152600660205260408120610e22908363ffffffff61160616565b60048054604080516020601f60026000196101006001881615020190951694909404938401819004810282018101909252828152606093909290918301828280156107cb5780601f106107a0576101008083540402835291602001916107cb565b600081565b60006107e9610eba610ff0565b84610b9d85604051806060016040528060258152602001611b276025913960016000610ee4610ff0565b6001600160a01b03908116825260208083019390935260409182016000908120918d1681529252902054919063ffffffff61138916565b60006107e9610f28610ff0565b8484611222565b60008181526006602052604081206107ed9061161b565b600082815260066020526040902060020154610f6490610bfa610ff0565b610cac5760405162461bcd60e51b8152600401808060200182810382526030815260200180611a406030913960400191505060405180910390fd5b6001600160a01b03918216600090815260016020908152604080832093909416825291909152205490565b604080516d5052454449434154455f524f4c4560901b8152905190819003600e01902081565b6000610ffa611626565b905090565b6001600160a01b0383166110445760405162461bcd60e51b8152600401808060200182810382526024815260200180611b036024913960400191505060405180910390fd5b6001600160a01b0382166110895760405162461bcd60e51b81526004018080602001828103825260228152602001806119f86022913960400191505060405180910390fd5b6001600160a01b03808416600081815260016020908152604080832094871680845294825291829020859055815185815291517f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b9259281900390910190a3505050565b60006001600160a01b0386166111325760405162461bcd60e51b8152600401808060200182810382526025815260200180611a706025913960400191505060405180910390fd5b600161114561114087611684565b611710565b83868660405160008152602001604052604051808581526020018460ff1660ff1681526020018381526020018281526020019450505050506020604051602081039080840390855afa15801561119f573d6000803e3d6000fd5b505050602060405103516001600160a01b0316866001600160a01b031614905095945050505050565b600082820183811015610e22576040805162461bcd60e51b815260206004820152601b60248201527f536166654d6174683a206164646974696f6e206f766572666c6f770000000000604482015290519081900360640190fd5b6001600160a01b0383166112675760405162461bcd60e51b8152600401808060200182810382526025815260200180611ade6025913960400191505060405180910390fd5b6001600160a01b0382166112ac5760405162461bcd60e51b81526004018080602001828103825260238152602001806119636023913960400191505060405180910390fd5b6112b7838383610de4565b6112fa81604051806060016040528060268152602001611a1a602691396001600160a01b038616600090815260208190526040902054919063ffffffff61138916565b6001600160a01b03808516600090815260208190526040808220939093559084168152205461132f908263ffffffff6111c816565b6001600160a01b038084166000818152602081815260409182902094909455805185815290519193928716927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef92918290030190a3505050565b600081848411156114185760405162461bcd60e51b81526004018080602001828103825283818151815260200191508051906020019080838360005b838110156113dd5781810151838201526020016113c5565b50505050905090810190601f16801561140a5780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b505050900390565b600082815260066020526040902061143e908263ffffffff61175c16565b15610c445761144b610ff0565b6001600160a01b0316816001600160a01b0316837f2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d60405160405180910390a45050565b60008281526006602052604090206114ad908263ffffffff61177116565b15610c44576114ba610ff0565b6001600160a01b0316816001600160a01b0316837ff6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b60405160405180910390a45050565b6001600160a01b038216611559576040805162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f206164647265737300604482015290519081900360640190fd5b61156560008383610de4565b600254611578908263ffffffff6111c816565b6002556001600160a01b0382166000908152602081905260409020546115a4908263ffffffff6111c816565b6001600160a01b0383166000818152602081815260408083209490945583518581529351929391927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9281900390910190a35050565b6000610e228383611786565b6000610e22836001600160a01b0384166117ea565b60006107ed82611802565b60003330141561167e5760606000368080601f0160208091040260200160405190810160405280939291908181526020018383808284376000920191909152505050503601516001600160a01b031691506116819050565b50335b90565b60006040518060800160405280604381526020016119b560439139805190602001208260000151836020015184604001518051906020012060405160200180858152602001848152602001836001600160a01b03166001600160a01b03168152602001828152602001945050505050604051602081830303815290604052805190602001209050919050565b600061171a610b19565b82604051602001808061190160f01b81525060020183815260200182815260200192505050604051602081830303815290604052805190602001209050919050565b6000610e22836001600160a01b038416611806565b6000610e22836001600160a01b038416611850565b815460009082106117c85760405162461bcd60e51b81526004018080602001828103825260228152602001806119416022913960400191505060405180910390fd5b8260000182815481106117d757fe5b9060005260206000200154905092915050565b60009081526001919091016020526040902054151590565b5490565b600061181283836117ea565b611848575081546001818101845560008481526020808220909301849055845484825282860190935260409020919091556107ed565b5060006107ed565b6000818152600183016020526040812054801561190c578354600019808301919081019060009087908390811061188357fe5b90600052602060002001549050808760000184815481106118a057fe5b6000918252602080832090910192909255828152600189810190925260409020908401905586548790806118d057fe5b600190038181906000526020600020016000905590558660010160008781526020019081526020016000206000905560019450505050506107ed565b60009150506107ed565b60405180606001604052806000815260200160006001600160a01b0316815260200160608152509056fe456e756d657261626c655365743a20696e646578206f7574206f6620626f756e647345524332303a207472616e7366657220746f20746865207a65726f2061646472657373416363657373436f6e74726f6c3a2073656e646572206d75737420626520616e2061646d696e20746f206772616e744d6574615472616e73616374696f6e2875696e74323536206e6f6e63652c616464726573732066726f6d2c62797465732066756e6374696f6e5369676e61747572652945524332303a20617070726f766520746f20746865207a65726f206164647265737345524332303a207472616e7366657220616d6f756e7420657863656564732062616c616e6365416363657373436f6e74726f6c3a2073656e646572206d75737420626520616e2061646d696e20746f207265766f6b654e61746976654d6574615472616e73616374696f6e3a20494e56414c49445f5349474e455245524332303a207472616e7366657220616d6f756e74206578636565647320616c6c6f77616e63655369676e657220616e64207369676e617475726520646f206e6f74206d6174636845524332303a207472616e736665722066726f6d20746865207a65726f206164647265737345524332303a20617070726f76652066726f6d20746865207a65726f206164647265737345524332303a2064656372656173656420616c6c6f77616e63652062656c6f77207a65726f416363657373436f6e74726f6c3a2063616e206f6e6c792072656e6f756e636520726f6c657320666f722073656c66a2646970667358221220c3ae32ab617519cb10785003a28b0a5d799a7625aa291c61ba33e6c0b37a43c164736f6c63430006060033454950373132446f6d61696e28737472696e67206e616d652c737472696e672076657273696f6e2c6164647265737320766572696679696e67436f6e74726163742c627974657333322073616c742900000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000153000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002706f000000000000000000000000000000000000000000000000000000000000",
    "contractAddress": "0xf57e7e7c23978c3caec3c3548e3d615c346e79ff",
    "cumulativeGasUsed": "10901992",
    "gasUsed": "1067948",
    "confirmations": "6396727",
    "methodId": "0x60a06040",
    "functionName": "",
    "trace_address": [
      -1
    ]
  },
  {
    "blockNumber": "13553639",
    "timeStamp": "1636075402",
    "hash": "0xe43487df834f3457c5767aed619d935ba977c3388f0e90fa89dad2261476b8d1",
    "nonce": "2",
    "blockHash": "0x4ce7a78fe0582746380f39262e9edf7570e97b4f3256ccdfde47bca3ada55dd0",
    "transactionIndex": "253",
    "from": "0xc783466a98f3685d8af3c962460304da4268e184",
    "to": "0xf57e7e7c23978c3caec3c3548e3d615c346e79ff",
    "value": "0",
    "gas": "69574",
    "gasPrice": "104648726251",
    "isError": "0",
    "txreceipt_status": "1",
    "input": "0x095ea7b30000000000000000000000005fdcca53617f4d2b9134b29090c87d01058e27e90000000000000000000000000000000000000000000000000de0b6b3a7640000",
    "contractAddress": "",
    "cumulativeGasUsed": "20879517",
    "gasUsed": "46383",
    "confirmations": "6258229",
    "methodId": "0x095ea7b3",
    "functionName": "approve(address _spender, uint256 _value)",
    "trace_address": [
      -1
    ]
  }
]
const assertions = {
  "0xafe9777c91eb0ca07c0e2455ff739ba02758e896684346b98f3892717fd91d9c": [
    {
      "method": "not-reverted",
      "args": ""
    }
  ],
  "0xe43487df834f3457c5767aed619d935ba977c3388f0e90fa89dad2261476b8d1": [
    {
      "method": "emit",
      "args": [
        {
          "interface": {
            "fragments": [
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "minter",
                    "type": "address"
                  }
                ],
                "stateMutability": "nonpayable",
                "type": "constructor"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": true,
                    "internalType": "address",
                    "name": "owner",
                    "type": "address"
                  },
                  {
                    "indexed": true,
                    "internalType": "address",
                    "name": "spender",
                    "type": "address"
                  },
                  {
                    "indexed": false,
                    "internalType": "uint256",
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
                    "internalType": "bytes32",
                    "name": "role",
                    "type": "bytes32"
                  },
                  {
                    "indexed": true,
                    "internalType": "bytes32",
                    "name": "previousAdminRole",
                    "type": "bytes32"
                  },
                  {
                    "indexed": true,
                    "internalType": "bytes32",
                    "name": "newAdminRole",
                    "type": "bytes32"
                  }
                ],
                "name": "RoleAdminChanged",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": true,
                    "internalType": "bytes32",
                    "name": "role",
                    "type": "bytes32"
                  },
                  {
                    "indexed": true,
                    "internalType": "address",
                    "name": "account",
                    "type": "address"
                  },
                  {
                    "indexed": true,
                    "internalType": "address",
                    "name": "sender",
                    "type": "address"
                  }
                ],
                "name": "RoleGranted",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": true,
                    "internalType": "bytes32",
                    "name": "role",
                    "type": "bytes32"
                  },
                  {
                    "indexed": true,
                    "internalType": "address",
                    "name": "account",
                    "type": "address"
                  },
                  {
                    "indexed": true,
                    "internalType": "address",
                    "name": "sender",
                    "type": "address"
                  }
                ],
                "name": "RoleRevoked",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": true,
                    "internalType": "address",
                    "name": "from",
                    "type": "address"
                  },
                  {
                    "indexed": true,
                    "internalType": "address",
                    "name": "to",
                    "type": "address"
                  },
                  {
                    "indexed": false,
                    "internalType": "uint256",
                    "name": "value",
                    "type": "uint256"
                  }
                ],
                "name": "Transfer",
                "type": "event"
              },
              {
                "inputs": [],
                "name": "DEFAULT_ADMIN_ROLE",
                "outputs": [
                  {
                    "internalType": "bytes32",
                    "name": "",
                    "type": "bytes32"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [],
                "name": "MINTER_ROLE",
                "outputs": [
                  {
                    "internalType": "bytes32",
                    "name": "",
                    "type": "bytes32"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "owner",
                    "type": "address"
                  },
                  {
                    "internalType": "address",
                    "name": "spender",
                    "type": "address"
                  }
                ],
                "name": "allowance",
                "outputs": [
                  {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "spender",
                    "type": "address"
                  },
                  {
                    "internalType": "uint256",
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "approve",
                "outputs": [
                  {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                  }
                ],
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "account",
                    "type": "address"
                  }
                ],
                "name": "balanceOf",
                "outputs": [
                  {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [],
                "name": "cap",
                "outputs": [
                  {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [],
                "name": "decimals",
                "outputs": [
                  {
                    "internalType": "uint8",
                    "name": "",
                    "type": "uint8"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "spender",
                    "type": "address"
                  },
                  {
                    "internalType": "uint256",
                    "name": "subtractedValue",
                    "type": "uint256"
                  }
                ],
                "name": "decreaseAllowance",
                "outputs": [
                  {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                  }
                ],
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "bytes32",
                    "name": "role",
                    "type": "bytes32"
                  }
                ],
                "name": "getRoleAdmin",
                "outputs": [
                  {
                    "internalType": "bytes32",
                    "name": "",
                    "type": "bytes32"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "bytes32",
                    "name": "role",
                    "type": "bytes32"
                  },
                  {
                    "internalType": "address",
                    "name": "account",
                    "type": "address"
                  }
                ],
                "name": "grantRole",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "bytes32",
                    "name": "role",
                    "type": "bytes32"
                  },
                  {
                    "internalType": "address",
                    "name": "account",
                    "type": "address"
                  }
                ],
                "name": "hasRole",
                "outputs": [
                  {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "spender",
                    "type": "address"
                  },
                  {
                    "internalType": "uint256",
                    "name": "addedValue",
                    "type": "uint256"
                  }
                ],
                "name": "increaseAllowance",
                "outputs": [
                  {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                  }
                ],
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "to",
                    "type": "address"
                  },
                  {
                    "internalType": "uint256",
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "mint",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "inputs": [],
                "name": "name",
                "outputs": [
                  {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "bytes32",
                    "name": "role",
                    "type": "bytes32"
                  },
                  {
                    "internalType": "address",
                    "name": "account",
                    "type": "address"
                  }
                ],
                "name": "renounceRole",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "bytes32",
                    "name": "role",
                    "type": "bytes32"
                  },
                  {
                    "internalType": "address",
                    "name": "account",
                    "type": "address"
                  }
                ],
                "name": "revokeRole",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "bytes4",
                    "name": "interfaceId",
                    "type": "bytes4"
                  }
                ],
                "name": "supportsInterface",
                "outputs": [
                  {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [],
                "name": "symbol",
                "outputs": [
                  {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [],
                "name": "totalSupply",
                "outputs": [
                  {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "recipient",
                    "type": "address"
                  },
                  {
                    "internalType": "uint256",
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "transfer",
                "outputs": [
                  {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                  }
                ],
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "sender",
                    "type": "address"
                  },
                  {
                    "internalType": "address",
                    "name": "recipient",
                    "type": "address"
                  },
                  {
                    "internalType": "uint256",
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "transferFrom",
                "outputs": [
                  {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                  }
                ],
                "stateMutability": "nonpayable",
                "type": "function"
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
        "0xc783466A98f3685d8AF3c962460304dA4268e184",
        "0x5FDCCA53617f4d2b9134B29090C87D01058e27e9",
        "0xde0b6b3a7640000"
      ]
    },
    {
      "method": "equal",
      "args": "0000000000000000000000000000000000000000000000000000000000000001"
    }
  ]
}
