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
    "blockNumber": "12876179",
    "timeStamp": "1626956761",
    "hash": "0xe632f3e39c73b57a160c44451ff4ba8f19b80a0e60ab54a4e686a0f0687d81d4",
    "nonce": "2",
    "blockHash": "0x13e906e02f1139e192dd23116e06275cc6d5e5a3447cb9e8085b1a041283ff92",
    "transactionIndex": "3",
    "from": "0xe9da256a28630efdc637bfd4c65f0887be1aeda8",
    "to": "",
    "value": "0",
    "gas": "6721975",
    "gasPrice": "20000000000",
    "isError": "0",
    "txreceipt_status": "1",
    "input": "0x60806040526064600c5566d529ae9e860000600d55600e805474fc86a64a8de22cf25410f7601acbd8d6630da93d016001600160a81b0319909116179055600f80546001600160a01b0319908116734265de963cdd60629d03fee2cd3285e6d5ff601517909155601080548216731b33eba79c4dd7243e5a3456fc497b930db054b2179055601180549091167392d79ccace3fc606845f3a66c9aed75d8e5487a9179055348015620000b057600080fd5b506040516200309638038062003096833981016040819052620000d39162000a08565b6040805180820182526009815268436f6f6c204361747360b81b60208083019182528351808501909452600484526310d3d3d360e21b908401528151919291620001209160009162000931565b5080516200013690600190602084019062000931565b50505060006200014b6200021460201b60201c565b600a80546001600160a01b0319166001600160a01b038316908117909155604051919250906000907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0908290a350620001a48162000218565b600e54620001c29061010090046001600160a01b0316600062000291565b600f54620001db906001600160a01b0316600162000291565b601054620001f4906001600160a01b0316600262000291565b6011546200020d906001600160a01b0316600362000291565b5062000be3565b3390565b600a546001600160a01b03163314620002785760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657260448201526064015b60405180910390fd5b80516200028d90600b90602084019062000931565b5050565b6200028d828260405180602001604052806000815250620002b360201b60201c565b620002bf83836200032b565b620002ce600084848462000481565b620003265760405162461bcd60e51b815260206004820152603260248201526000805160206200307683398151915260448201527131b2b4bb32b91034b6b83632b6b2b73a32b960711b60648201526084016200026f565b505050565b6001600160a01b038216620003835760405162461bcd60e51b815260206004820181905260248201527f4552433732313a206d696e7420746f20746865207a65726f206164647265737360448201526064016200026f565b6000818152600260205260409020546001600160a01b031615620003ea5760405162461bcd60e51b815260206004820152601c60248201527f4552433732313a20746f6b656e20616c7265616479206d696e7465640000000060448201526064016200026f565b620003f860008383620005ea565b6001600160a01b03821660009081526003602052604081208054600192906200042390849062000b12565b909155505060008181526002602052604080822080546001600160a01b0319166001600160a01b03861690811790915590518392907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908290a45050565b6000620004a2846001600160a01b0316620006c660201b620013dd1760201c565b15620005de57604051630a85bd0160e11b81526001600160a01b0385169063150b7a0290620004dc90339089908890889060040162000abc565b602060405180830381600087803b158015620004f757600080fd5b505af19250505080156200052a575060408051601f3d908101601f191682019092526200052791810190620009d7565b60015b620005c3573d8080156200055b576040519150601f19603f3d011682016040523d82523d6000602084013e62000560565b606091505b508051620005bb5760405162461bcd60e51b815260206004820152603260248201526000805160206200307683398151915260448201527131b2b4bb32b91034b6b83632b6b2b73a32b960711b60648201526084016200026f565b805181602001fd5b6001600160e01b031916630a85bd0160e11b149050620005e2565b5060015b949350505050565b620006028383836200032660201b620008171760201c565b6001600160a01b03831662000660576200065a81600880546000838152600960205260408120829055600182018355919091527ff3f7a9fe364faab93b216da50a3214154f22a0a2b415b23a84c8169e8b636ee30155565b62000686565b816001600160a01b0316836001600160a01b0316146200068657620006868382620006cc565b6001600160a01b038216620006a057620003268162000779565b826001600160a01b0316826001600160a01b031614620003265762000326828262000857565b3b151590565b60006001620006e684620008a860201b62000b7d1760201c565b620006f2919062000b2d565b60008381526007602052604090205490915080821462000746576001600160a01b03841660009081526006602090815260408083208584528252808320548484528184208190558352600790915290208190555b5060009182526007602090815260408084208490556001600160a01b039094168352600681528383209183525290812055565b6008546000906200078d9060019062000b2d565b60008381526009602052604081205460088054939450909284908110620007c457634e487b7160e01b600052603260045260246000fd5b906000526020600020015490508060088381548110620007f457634e487b7160e01b600052603260045260246000fd5b60009182526020808320909101929092558281526009909152604080822084905585825281205560088054806200083b57634e487b7160e01b600052603160045260246000fd5b6001900381819060005260206000200160009055905550505050565b60006200086f83620008a860201b62000b7d1760201c565b6001600160a01b039093166000908152600660209081526040808320868452825280832085905593825260079052919091209190915550565b60006001600160a01b038216620009155760405162461bcd60e51b815260206004820152602a60248201527f4552433732313a2062616c616e636520717565727920666f7220746865207a65604482015269726f206164647265737360b01b60648201526084016200026f565b506001600160a01b031660009081526003602052604090205490565b8280546200093f9062000b7a565b90600052602060002090601f016020900481019282620009635760008555620009ae565b82601f106200097e57805160ff1916838001178555620009ae565b82800160010185558215620009ae579182015b82811115620009ae57825182559160200191906001019062000991565b50620009bc929150620009c0565b5090565b5b80821115620009bc5760008155600101620009c1565b600060208284031215620009e9578081fd5b81516001600160e01b03198116811462000a01578182fd5b9392505050565b60006020828403121562000a1a578081fd5b81516001600160401b038082111562000a31578283fd5b818401915084601f83011262000a45578283fd5b81518181111562000a5a5762000a5a62000bcd565b604051601f8201601f19908116603f0116810190838211818310171562000a855762000a8562000bcd565b8160405282815287602084870101111562000a9e578586fd5b62000ab183602083016020880162000b47565b979650505050505050565b600060018060a01b03808716835280861660208401525083604083015260806060830152825180608084015262000afb8160a085016020870162000b47565b601f01601f19169190910160a00195945050505050565b6000821982111562000b285762000b2862000bb7565b500190565b60008282101562000b425762000b4262000bb7565b500390565b60005b8381101562000b6457818101518382015260200162000b4a565b8381111562000b74576000848401525b50505050565b600181811c9082168062000b8f57607f821691505b6020821081141562000bb157634e487b7160e01b600052602260045260246000fd5b50919050565b634e487b7160e01b600052601160045260246000fd5b634e487b7160e01b600052604160045260246000fd5b6124838062000bf36000396000f3fe6080604052600436106101b75760003560e01c806370a08231116100ec57806398d5fdca1161008a578063c87b56dd11610064578063c87b56dd146104ab578063ca800144146104cb578063e985e9c5146104eb578063f2fde38b1461053457600080fd5b806398d5fdca14610456578063a22cb4651461046b578063b88d4fde1461048b57600080fd5b80638588b2c5116100c65780638588b2c5146103f05780638da5cb5b1461040357806391b7f5ed1461042157806395d89b411461044157600080fd5b806370a08231146103b3578063715018a6146103d3578063853828b6146103e857600080fd5b806323b872dd11610159578063438b630011610133578063438b6300146103265780634f6ccce71461035357806355f804b3146103735780636352211e1461039357600080fd5b806323b872dd146102c65780632f745c59146102e657806342842e0e1461030657600080fd5b8063081812fc11610195578063081812fc14610235578063095ea7b31461026d57806316c61ccc1461028d57806318160ddd146102a757600080fd5b806301ffc9a7146101bc57806302329a29146101f157806306fdde0314610213575b600080fd5b3480156101c857600080fd5b506101dc6101d7366004612159565b610554565b60405190151581526020015b60405180910390f35b3480156101fd57600080fd5b5061021161020c36600461213f565b61057f565b005b34801561021f57600080fd5b506102286105df565b6040516101e891906122ca565b34801561024157600080fd5b506102556102503660046121d7565b610671565b6040516001600160a01b0390911681526020016101e8565b34801561027957600080fd5b50610211610288366004612116565b610706565b34801561029957600080fd5b50600e546101dc9060ff1681565b3480156102b357600080fd5b506008545b6040519081526020016101e8565b3480156102d257600080fd5b506102116102e1366004612039565b61081c565b3480156102f257600080fd5b506102b8610301366004612116565b610897565b34801561031257600080fd5b50610211610321366004612039565b61092d565b34801561033257600080fd5b50610346610341366004611fed565b610948565b6040516101e89190612286565b34801561035f57600080fd5b506102b861036e3660046121d7565b610a06565b34801561037f57600080fd5b5061021161038e366004612191565b610aa7565b34801561039f57600080fd5b506102556103ae3660046121d7565b610b06565b3480156103bf57600080fd5b506102b86103ce366004611fed565b610b7d565b3480156103df57600080fd5b50610211610c04565b610211610c96565b6102116103fe3660046121d7565b610dbc565b34801561040f57600080fd5b50600a546001600160a01b0316610255565b34801561042d57600080fd5b5061021161043c3660046121d7565b610f59565b34801561044d57600080fd5b50610228610fa6565b34801561046257600080fd5b50600d546102b8565b34801561047757600080fd5b506102116104863660046120ed565b610fb5565b34801561049757600080fd5b506102116104a6366004612074565b61107a565b3480156104b757600080fd5b506102286104c63660046121d7565b6110fc565b3480156104d757600080fd5b506102116104e6366004612116565b6111e5565b3480156104f757600080fd5b506101dc610506366004612007565b6001600160a01b03918216600090815260056020908152604080832093909416825291909152205460ff1690565b34801561054057600080fd5b5061021161054f366004611fed565b6112d4565b60006001600160e01b0319821663780e9d6360e01b14806105795750610579826113e3565b92915050565b600a546001600160a01b031633146105cc5760405162461bcd60e51b8152602060048201819052602482015260008051602061242e83398151915260448201526064015b60405180910390fd5b600e805460ff1916911515919091179055565b6060600080546105ee9061236b565b80601f016020809104026020016040519081016040528092919081815260200182805461061a9061236b565b80156106675780601f1061063c57610100808354040283529160200191610667565b820191906000526020600020905b81548152906001019060200180831161064a57829003601f168201915b5050505050905090565b6000818152600260205260408120546001600160a01b03166106ea5760405162461bcd60e51b815260206004820152602c60248201527f4552433732313a20617070726f76656420717565727920666f72206e6f6e657860448201526b34b9ba32b73a103a37b5b2b760a11b60648201526084016105c3565b506000908152600460205260409020546001600160a01b031690565b600061071182610b06565b9050806001600160a01b0316836001600160a01b0316141561077f5760405162461bcd60e51b815260206004820152602160248201527f4552433732313a20617070726f76616c20746f2063757272656e74206f776e656044820152603960f91b60648201526084016105c3565b336001600160a01b038216148061079b575061079b8133610506565b61080d5760405162461bcd60e51b815260206004820152603860248201527f4552433732313a20617070726f76652063616c6c6572206973206e6f74206f7760448201527f6e6572206e6f7220617070726f76656420666f7220616c6c000000000000000060648201526084016105c3565b6108178383611433565b505050565b61082633826114a1565b61088c5760405162461bcd60e51b815260206004820152603160248201527f4552433732313a207472616e736665722063616c6c6572206973206e6f74206f6044820152701ddb995c881b9bdc88185c1c1c9bdd9959607a1b60648201526084016105c3565b610817838383611598565b60006108a283610b7d565b82106109045760405162461bcd60e51b815260206004820152602b60248201527f455243373231456e756d657261626c653a206f776e657220696e646578206f7560448201526a74206f6620626f756e647360a81b60648201526084016105c3565b506001600160a01b03919091166000908152600660209081526040808320938352929052205490565b6108178383836040518060200160405280600081525061107a565b6060600061095583610b7d565b905060008167ffffffffffffffff81111561098057634e487b7160e01b600052604160045260246000fd5b6040519080825280602002602001820160405280156109a9578160200160208202803683370190505b50905060005b828110156109fe576109c18582610897565b8282815181106109e157634e487b7160e01b600052603260045260246000fd5b6020908102919091010152806109f6816123a6565b9150506109af565b509392505050565b6000610a1160085490565b8210610a745760405162461bcd60e51b815260206004820152602c60248201527f455243373231456e756d657261626c653a20676c6f62616c20696e646578206f60448201526b7574206f6620626f756e647360a01b60648201526084016105c3565b60088281548110610a9557634e487b7160e01b600052603260045260246000fd5b90600052602060002001549050919050565b600a546001600160a01b03163314610aef5760405162461bcd60e51b8152602060048201819052602482015260008051602061242e83398151915260448201526064016105c3565b8051610b0290600b906020840190611eb2565b5050565b6000818152600260205260408120546001600160a01b0316806105795760405162461bcd60e51b815260206004820152602960248201527f4552433732313a206f776e657220717565727920666f72206e6f6e657869737460448201526832b73a103a37b5b2b760b91b60648201526084016105c3565b60006001600160a01b038216610be85760405162461bcd60e51b815260206004820152602a60248201527f4552433732313a2062616c616e636520717565727920666f7220746865207a65604482015269726f206164647265737360b01b60648201526084016105c3565b506001600160a01b031660009081526003602052604090205490565b600a546001600160a01b03163314610c4c5760405162461bcd60e51b8152602060048201819052602482015260008051602061242e83398151915260448201526064016105c3565b600a546040516000916001600160a01b0316907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0908390a3600a80546001600160a01b0319169055565b600a546001600160a01b03163314610cde5760405162461bcd60e51b8152602060048201819052602482015260008051602061242e83398151915260448201526064016105c3565b6000610ceb6004476122f5565b600e5460405191925061010090046001600160a01b0316906108fc8315029083906000818181858888f19350505050610d2357600080fd5b600f546040516001600160a01b039091169082156108fc029083906000818181858888f19350505050610d5557600080fd5b6010546040516001600160a01b039091169082156108fc029083906000818181858888f19350505050610d8757600080fd5b6011546040516001600160a01b039091169082156108fc029083906000818181858888f19350505050610db957600080fd5b50565b6000610dc760085490565b600e5490915060ff1615610e0b5760405162461bcd60e51b815260206004820152600b60248201526a14d85b19481c185d5cd95960aa1b60448201526064016105c3565b60158210610e665760405162461bcd60e51b815260206004820152602260248201527f596f752063616e2061646f70742061206d6178696d756d206f66203230204361604482015261747360f01b60648201526084016105c3565b600c54610e7590612710612328565b610e7f83836122dd565b10610ecc5760405162461bcd60e51b815260206004820152601b60248201527f45786365656473206d6178696d756d204361747320737570706c79000000000060448201526064016105c3565b81600d54610eda9190612309565b341015610f295760405162461bcd60e51b815260206004820152601960248201527f45746865722073656e74206973206e6f7420636f72726563740000000000000060448201526064016105c3565b60005b8281101561081757610f4733610f4283856122dd565b611743565b80610f51816123a6565b915050610f2c565b600a546001600160a01b03163314610fa15760405162461bcd60e51b8152602060048201819052602482015260008051602061242e83398151915260448201526064016105c3565b600d55565b6060600180546105ee9061236b565b6001600160a01b03821633141561100e5760405162461bcd60e51b815260206004820152601960248201527f4552433732313a20617070726f766520746f2063616c6c65720000000000000060448201526064016105c3565b3360008181526005602090815260408083206001600160a01b03871680855290835292819020805460ff191686151590811790915590519081529192917f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31910160405180910390a35050565b61108433836114a1565b6110ea5760405162461bcd60e51b815260206004820152603160248201527f4552433732313a207472616e736665722063616c6c6572206973206e6f74206f6044820152701ddb995c881b9bdc88185c1c1c9bdd9959607a1b60648201526084016105c3565b6110f68484848461175d565b50505050565b6000818152600260205260409020546060906001600160a01b03166111895760405162461bcd60e51b815260206004820152602f60248201527f4552433732314d657461646174613a2055524920717565727920666f72206e6f60448201527f6e6578697374656e7420746f6b656e000000000000000000000000000000000060648201526084016105c3565b60006111936117db565b905060008151116111b357604051806020016040528060008152506111de565b806111bd846117ea565b6040516020016111ce92919061221b565b6040516020818303038152906040525b9392505050565b600a546001600160a01b0316331461122d5760405162461bcd60e51b8152602060048201819052602482015260008051602061242e83398151915260448201526064016105c3565b600c5481111561127f5760405162461bcd60e51b815260206004820152601b60248201527f457863656564732072657365727665642043617420737570706c79000000000060448201526064016105c3565b600061128a60085490565b905060005b828110156112b7576112a584610f4283856122dd565b806112af816123a6565b91505061128f565b5081600c60008282546112ca9190612328565b9091555050505050565b600a546001600160a01b0316331461131c5760405162461bcd60e51b8152602060048201819052602482015260008051602061242e83398151915260448201526064016105c3565b6001600160a01b0381166113815760405162461bcd60e51b815260206004820152602660248201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160448201526564647265737360d01b60648201526084016105c3565b600a546040516001600160a01b038084169216907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e090600090a3600a80546001600160a01b0319166001600160a01b0392909216919091179055565b3b151590565b60006001600160e01b031982166380ac58cd60e01b148061141457506001600160e01b03198216635b5e139f60e01b145b8061057957506301ffc9a760e01b6001600160e01b0319831614610579565b600081815260046020526040902080546001600160a01b0319166001600160a01b038416908117909155819061146882610b06565b6001600160a01b03167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560405160405180910390a45050565b6000818152600260205260408120546001600160a01b031661151a5760405162461bcd60e51b815260206004820152602c60248201527f4552433732313a206f70657261746f7220717565727920666f72206e6f6e657860448201526b34b9ba32b73a103a37b5b2b760a11b60648201526084016105c3565b600061152583610b06565b9050806001600160a01b0316846001600160a01b031614806115605750836001600160a01b031661155584610671565b6001600160a01b0316145b8061159057506001600160a01b0380821660009081526005602090815260408083209388168352929052205460ff165b949350505050565b826001600160a01b03166115ab82610b06565b6001600160a01b0316146116135760405162461bcd60e51b815260206004820152602960248201527f4552433732313a207472616e73666572206f6620746f6b656e2074686174206960448201526839903737ba1037bbb760b91b60648201526084016105c3565b6001600160a01b0382166116755760405162461bcd60e51b8152602060048201526024808201527f4552433732313a207472616e7366657220746f20746865207a65726f206164646044820152637265737360e01b60648201526084016105c3565b61168083838361191c565b61168b600082611433565b6001600160a01b03831660009081526003602052604081208054600192906116b4908490612328565b90915550506001600160a01b03821660009081526003602052604081208054600192906116e29084906122dd565b909155505060008181526002602052604080822080546001600160a01b0319166001600160a01b0386811691821790925591518493918716917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef91a4505050565b610b028282604051806020016040528060008152506119d4565b611768848484611598565b61177484848484611a52565b6110f65760405162461bcd60e51b815260206004820152603260248201527f4552433732313a207472616e7366657220746f206e6f6e20455243373231526560448201527131b2b4bb32b91034b6b83632b6b2b73a32b960711b60648201526084016105c3565b6060600b80546105ee9061236b565b60608161180e5750506040805180820190915260018152600360fc1b602082015290565b8160005b81156118385780611822816123a6565b91506118319050600a836122f5565b9150611812565b60008167ffffffffffffffff81111561186157634e487b7160e01b600052604160045260246000fd5b6040519080825280601f01601f19166020018201604052801561188b576020820181803683370190505b5090505b8415611590576118a0600183612328565b91506118ad600a866123c1565b6118b89060306122dd565b60f81b8183815181106118db57634e487b7160e01b600052603260045260246000fd5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a905350611915600a866122f5565b945061188f565b6001600160a01b0383166119775761197281600880546000838152600960205260408120829055600182018355919091527ff3f7a9fe364faab93b216da50a3214154f22a0a2b415b23a84c8169e8b636ee30155565b61199a565b816001600160a01b0316836001600160a01b03161461199a5761199a8382611baa565b6001600160a01b0382166119b15761081781611c47565b826001600160a01b0316826001600160a01b031614610817576108178282611d20565b6119de8383611d64565b6119eb6000848484611a52565b6108175760405162461bcd60e51b815260206004820152603260248201527f4552433732313a207472616e7366657220746f206e6f6e20455243373231526560448201527131b2b4bb32b91034b6b83632b6b2b73a32b960711b60648201526084016105c3565b60006001600160a01b0384163b15611b9f57604051630a85bd0160e11b81526001600160a01b0385169063150b7a0290611a9690339089908890889060040161224a565b602060405180830381600087803b158015611ab057600080fd5b505af1925050508015611ae0575060408051601f3d908101601f19168201909252611add91810190612175565b60015b611b85573d808015611b0e576040519150601f19603f3d011682016040523d82523d6000602084013e611b13565b606091505b508051611b7d5760405162461bcd60e51b815260206004820152603260248201527f4552433732313a207472616e7366657220746f206e6f6e20455243373231526560448201527131b2b4bb32b91034b6b83632b6b2b73a32b960711b60648201526084016105c3565b805181602001fd5b6001600160e01b031916630a85bd0160e11b149050611590565b506001949350505050565b60006001611bb784610b7d565b611bc19190612328565b600083815260076020526040902054909150808214611c14576001600160a01b03841660009081526006602090815260408083208584528252808320548484528184208190558352600790915290208190555b5060009182526007602090815260408084208490556001600160a01b039094168352600681528383209183525290812055565b600854600090611c5990600190612328565b60008381526009602052604081205460088054939450909284908110611c8f57634e487b7160e01b600052603260045260246000fd5b906000526020600020015490508060088381548110611cbe57634e487b7160e01b600052603260045260246000fd5b6000918252602080832090910192909255828152600990915260408082208490558582528120556008805480611d0457634e487b7160e01b600052603160045260246000fd5b6001900381819060005260206000200160009055905550505050565b6000611d2b83610b7d565b6001600160a01b039093166000908152600660209081526040808320868452825280832085905593825260079052919091209190915550565b6001600160a01b038216611dba5760405162461bcd60e51b815260206004820181905260248201527f4552433732313a206d696e7420746f20746865207a65726f206164647265737360448201526064016105c3565b6000818152600260205260409020546001600160a01b031615611e1f5760405162461bcd60e51b815260206004820152601c60248201527f4552433732313a20746f6b656e20616c7265616479206d696e7465640000000060448201526064016105c3565b611e2b6000838361191c565b6001600160a01b0382166000908152600360205260408120805460019290611e549084906122dd565b909155505060008181526002602052604080822080546001600160a01b0319166001600160a01b03861690811790915590518392907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908290a45050565b828054611ebe9061236b565b90600052602060002090601f016020900481019282611ee05760008555611f26565b82601f10611ef957805160ff1916838001178555611f26565b82800160010185558215611f26579182015b82811115611f26578251825591602001919060010190611f0b565b50611f32929150611f36565b5090565b5b80821115611f325760008155600101611f37565b600067ffffffffffffffff80841115611f6657611f66612401565b604051601f8501601f19908116603f01168101908282118183101715611f8e57611f8e612401565b81604052809350858152868686011115611fa757600080fd5b858560208301376000602087830101525050509392505050565b80356001600160a01b0381168114611fd857600080fd5b919050565b80358015158114611fd857600080fd5b600060208284031215611ffe578081fd5b6111de82611fc1565b60008060408385031215612019578081fd5b61202283611fc1565b915061203060208401611fc1565b90509250929050565b60008060006060848603121561204d578081fd5b61205684611fc1565b925061206460208501611fc1565b9150604084013590509250925092565b60008060008060808587031215612089578081fd5b61209285611fc1565b93506120a060208601611fc1565b925060408501359150606085013567ffffffffffffffff8111156120c2578182fd5b8501601f810187136120d2578182fd5b6120e187823560208401611f4b565b91505092959194509250565b600080604083850312156120ff578182fd5b61210883611fc1565b915061203060208401611fdd565b60008060408385031215612128578182fd5b61213183611fc1565b946020939093013593505050565b600060208284031215612150578081fd5b6111de82611fdd565b60006020828403121561216a578081fd5b81356111de81612417565b600060208284031215612186578081fd5b81516111de81612417565b6000602082840312156121a2578081fd5b813567ffffffffffffffff8111156121b8578182fd5b8201601f810184136121c8578182fd5b61159084823560208401611f4b565b6000602082840312156121e8578081fd5b5035919050565b6000815180845261220781602086016020860161233f565b601f01601f19169290920160200192915050565b6000835161222d81846020880161233f565b83519083019061224181836020880161233f565b01949350505050565b60006001600160a01b0380871683528086166020840152508360408301526080606083015261227c60808301846121ef565b9695505050505050565b6020808252825182820181905260009190848201906040850190845b818110156122be578351835292840192918401916001016122a2565b50909695505050505050565b6020815260006111de60208301846121ef565b600082198211156122f0576122f06123d5565b500190565b600082612304576123046123eb565b500490565b6000816000190483118215151615612323576123236123d5565b500290565b60008282101561233a5761233a6123d5565b500390565b60005b8381101561235a578181015183820152602001612342565b838111156110f65750506000910152565b600181811c9082168061237f57607f821691505b602082108114156123a057634e487b7160e01b600052602260045260246000fd5b50919050565b60006000198214156123ba576123ba6123d5565b5060010190565b6000826123d0576123d06123eb565b500690565b634e487b7160e01b600052601160045260246000fd5b634e487b7160e01b600052601260045260246000fd5b634e487b7160e01b600052604160045260246000fd5b6001600160e01b031981168114610db957600080fdfe4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572a2646970667358221220e5e65875d8d97dc0a51450e3c9afbf56c3b2fd48ed324a70c01a605efeaf13e064736f6c634300080400334552433732313a207472616e7366657220746f206e6f6e2045524337323152650000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002568747470733a2f2f6170692e707564677970656e6775696e732e696f2f70656e6775696e2f000000000000000000000000000000000000000000000000000000",
    "contractAddress": "0xbd3531da5cf5857e7cfaa92426877b022e612cf8",
    "cumulativeGasUsed": "4891353",
    "gasUsed": "4283901",
    "confirmations": "6934909",
    "methodId": "0x60806040",
    "functionName": "atInversebrah(int248 a, uint48[] b, uint32 c, bytes20[] d, bytes30[] e)",
    "trace_address": [
      -1
    ]
  },
  {
    "blockNumber": "12878190",
    "timeStamp": "1626983974",
    "hash": "0xb1614b67923d5fb8e3ab9b4112c39836e3b0b15195550643bac9cb5de7885957",
    "nonce": "6",
    "blockHash": "0x9d510559dba6ba79f2945ff241572d181f90cf64b51087d863c9560e74e09eb1",
    "transactionIndex": "127",
    "from": "0xe9da256a28630efdc637bfd4c65f0887be1aeda8",
    "to": "0xbd3531da5cf5857e7cfaa92426877b022e612cf8",
    "value": "0",
    "gas": "28605",
    "gasPrice": "19800000000",
    "isError": "0",
    "txreceipt_status": "1",
    "input": "0x02329a290000000000000000000000000000000000000000000000000000000000000000",
    "contractAddress": "",
    "cumulativeGasUsed": "10448788",
    "gasUsed": "28605",
    "confirmations": "6932898",
    "methodId": "0x02329a29",
    "functionName": "pause(bool _isPause)",
    "trace_address": [
      -1
    ]
  }
]
const assertions = {
  "0xb1614b67923d5fb8e3ab9b4112c39836e3b0b15195550643bac9cb5de7885957": [
    {
      "method": "not-reverted",
      "args": ""
    }
  ],
  "0xe632f3e39c73b57a160c44451ff4ba8f19b80a0e60ab54a4e686a0f0687d81d4": [
    {
      "method": "not-reverted",
      "args": ""
    }
  ]
}
