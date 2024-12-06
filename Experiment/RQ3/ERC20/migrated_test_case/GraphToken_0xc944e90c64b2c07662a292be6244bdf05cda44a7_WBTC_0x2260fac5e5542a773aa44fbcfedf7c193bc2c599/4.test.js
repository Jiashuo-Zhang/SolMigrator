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
    "blockNumber": "11446769",
    "timeStamp": "1607890633",
    "hash": "0x079625b9f58a40f1948b396b7007d09ff4aa193d7ec798923910fc179294cab8",
    "nonce": "182",
    "blockHash": "0xec214b350fe1839500d8f10e6bb0a132a224d526c1e4fc5c939f3183bb6df8d0",
    "transactionIndex": "17",
    "from": "0x06590a641dc3eb43f2cebe435576389f209116da",
    "to": "",
    "value": "0",
    "gas": "1554617",
    "gasPrice": "60000000000",
    "isError": "0",
    "txreceipt_status": "1",
    "input": "0x6005805460a860020a61ffff0219169055600b60808181527f577261707065642042544300000000000000000000000000000000000000000060a0908152610100604052600460c09081527f574254430000000000000000000000000000000000000000000000000000000060e0529192600891620000829160039190620000c7565b50815162000098906004906020850190620000c7565b506005805460ff191660ff929092169190911761010060a860020a0319166101003302179055506200016c9050565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106200010a57805160ff19168380011785556200013a565b828001600101855582156200013a579182015b828111156200013a5782518255916020019190600101906200011d565b50620001489291506200014c565b5090565b6200016991905b8082111562000148576000815560010162000153565b90565b6111e6806200017c6000396000f30060806040526004361061013d5763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166305d2035b811461014257806306fdde031461016b578063095ea7b3146101f557806317ffc3201461021957806318160ddd1461023c57806323b872dd14610263578063313ce5671461028d5780633f4ba83a146102b857806340c10f19146102cd57806342966c68146102f15780634e71e0c8146103095780635c975abb1461031e578063661884631461033357806370a0823114610357578063715018a6146103785780637d64bcb41461038d5780638456cb59146103a25780638da5cb5b146103b757806395d89b41146103e8578063a9059cbb146103fd578063d73dd62314610421578063dd62ed3e14610445578063e30c39781461046c578063f2fde38b14610481575b600080fd5b34801561014e57600080fd5b506101576104a2565b604080519115158252519081900360200190f35b34801561017757600080fd5b506101806104c4565b6040805160208082528351818301528351919283929083019185019080838360005b838110156101ba5781810151838201526020016101a2565b50505050905090810190601f1680156101e75780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34801561020157600080fd5b50610157600160a060020a0360043516602435610552565b34801561022557600080fd5b5061023a600160a060020a036004351661057d565b005b34801561024857600080fd5b50610251610655565b60408051918252519081900360200190f35b34801561026f57600080fd5b50610157600160a060020a036004358116906024351660443561065b565b34801561029957600080fd5b506102a2610688565b6040805160ff9092168252519081900360200190f35b3480156102c457600080fd5b5061023a610691565b3480156102d957600080fd5b50610157600160a060020a0360043516602435610710565b3480156102fd57600080fd5b5061023a60043561081f565b34801561031557600080fd5b5061023a610847565b34801561032a57600080fd5b506101576108ef565b34801561033f57600080fd5b50610157600160a060020a03600435166024356108ff565b34801561036357600080fd5b50610251600160a060020a0360043516610923565b34801561038457600080fd5b5061023a61093e565b34801561039957600080fd5b506101576109c1565b3480156103ae57600080fd5b5061023a6109e6565b3480156103c357600080fd5b506103cc610a6a565b60408051600160a060020a039092168252519081900360200190f35b3480156103f457600080fd5b50610180610a7e565b34801561040957600080fd5b50610157600160a060020a0360043516602435610ad9565b34801561042d57600080fd5b50610157600160a060020a0360043516602435610afd565b34801561045157600080fd5b50610251600160a060020a0360043581169060243516610b21565b34801561047857600080fd5b506103cc610b4c565b34801561048d57600080fd5b5061023a600160a060020a0360043516610b5b565b6005547501000000000000000000000000000000000000000000900460ff1681565b6003805460408051602060026001851615610100026000190190941693909304601f8101849004840282018401909252818152929183018282801561054a5780601f1061051f5761010080835404028352916020019161054a565b820191906000526020600020905b81548152906001019060200180831161052d57829003601f168201915b505050505081565b60055460009060b060020a900460ff161561056c57600080fd5b6105768383610ba6565b9392505050565b6005546000906101009004600160a060020a0316331461059c57600080fd5b604080517f70a082310000000000000000000000000000000000000000000000000000000081523060048201529051600160a060020a038416916370a082319160248083019260209291908290030181600087803b1580156105fd57600080fd5b505af1158015610611573d6000803e3d6000fd5b505050506040513d602081101561062757600080fd5b505160055490915061065190600160a060020a03848116916101009004168363ffffffff610c0c16565b5050565b60015490565b60055460009060b060020a900460ff161561067557600080fd5b610680848484610cc4565b949350505050565b60055460ff1681565b6005546101009004600160a060020a031633146106ad57600080fd5b60055460b060020a900460ff1615156106c557600080fd5b6005805476ff00000000000000000000000000000000000000000000191690556040517f7805862f689e2f13df9f062ff482ad3ad112aca9e0847911ed832e158c525b3390600090a1565b6005546000906101009004600160a060020a0316331461072f57600080fd5b6005547501000000000000000000000000000000000000000000900460ff161561075857600080fd5b60015461076b908363ffffffff610e2716565b600155600160a060020a038316600090815260208190526040902054610797908363ffffffff610e2716565b600160a060020a03841660008181526020818152604091829020939093558051858152905191927f0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d412139688592918290030190a2604080518381529051600160a060020a0385169160009160008051602061119b8339815191529181900360200190a350600192915050565b6005546101009004600160a060020a0316331461083b57600080fd5b61084481610e3a565b50565b600654600160a060020a0316331461085e57600080fd5b600654600554604051600160a060020a0392831692610100909204909116907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e090600090a3600680546005805474ffffffffffffffffffffffffffffffffffffffff001916610100600160a060020a0384160217905573ffffffffffffffffffffffffffffffffffffffff19169055565b60055460b060020a900460ff1681565b60055460009060b060020a900460ff161561091957600080fd5b6105768383610e44565b600160a060020a031660009081526020819052604090205490565b6005546101009004600160a060020a0316331461095a57600080fd5b604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601f60248201527f72656e6f756e63696e67206f776e65727368697020697320626c6f636b656400604482015290519081900360640190fd5b6005546000906101009004600160a060020a031633146109e057600080fd5b50600090565b6005546101009004600160a060020a03163314610a0257600080fd5b60055460b060020a900460ff1615610a1957600080fd5b6005805476ff00000000000000000000000000000000000000000000191660b060020a1790556040517f6985a02210a168e66602d3235cb6db0e70f92b3ba4d376a33c0f3d9434bff62590600090a1565b6005546101009004600160a060020a031681565b6004805460408051602060026001851615610100026000190190941693909304601f8101849004840282018401909252818152929183018282801561054a5780601f1061051f5761010080835404028352916020019161054a565b60055460009060b060020a900460ff1615610af357600080fd5b6105768383610f33565b60055460009060b060020a900460ff1615610b1757600080fd5b6105768383611000565b600160a060020a03918216600090815260026020908152604080832093909416825291909152205490565b600654600160a060020a031681565b6005546101009004600160a060020a03163314610b7757600080fd5b6006805473ffffffffffffffffffffffffffffffffffffffff1916600160a060020a0392909216919091179055565b336000818152600260209081526040808320600160a060020a038716808552908352818420869055815186815291519394909390927f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925928290030190a350600192915050565b82600160a060020a031663a9059cbb83836040518363ffffffff167c01000000000000000000000000000000000000000000000000000000000281526004018083600160a060020a0316600160a060020a0316815260200182815260200192505050602060405180830381600087803b158015610c8857600080fd5b505af1158015610c9c573d6000803e3d6000fd5b505050506040513d6020811015610cb257600080fd5b50511515610cbf57600080fd5b505050565b600160a060020a038316600090815260208190526040812054821115610ce957600080fd5b600160a060020a0384166000908152600260209081526040808320338452909152902054821115610d1957600080fd5b600160a060020a0383161515610d2e57600080fd5b600160a060020a038416600090815260208190526040902054610d57908363ffffffff61109916565b600160a060020a038086166000908152602081905260408082209390935590851681522054610d8c908363ffffffff610e2716565b600160a060020a03808516600090815260208181526040808320949094559187168152600282528281203382529091522054610dce908363ffffffff61109916565b600160a060020a038086166000818152600260209081526040808320338452825291829020949094558051868152905192871693919260008051602061119b833981519152929181900390910190a35060019392505050565b81810182811015610e3457fe5b92915050565b61084433826110ab565b336000908152600260209081526040808320600160a060020a0386168452909152812054808310610e9857336000908152600260209081526040808320600160a060020a0388168452909152812055610ecd565b610ea8818463ffffffff61109916565b336000908152600260209081526040808320600160a060020a03891684529091529020555b336000818152600260209081526040808320600160a060020a0389168085529083529281902054815190815290519293927f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925929181900390910190a35060019392505050565b33600090815260208190526040812054821115610f4f57600080fd5b600160a060020a0383161515610f6457600080fd5b33600090815260208190526040902054610f84908363ffffffff61109916565b3360009081526020819052604080822092909255600160a060020a03851681522054610fb6908363ffffffff610e2716565b600160a060020a0384166000818152602081815260409182902093909355805185815290519192339260008051602061119b8339815191529281900390910190a350600192915050565b336000908152600260209081526040808320600160a060020a0386168452909152812054611034908363ffffffff610e2716565b336000818152600260209081526040808320600160a060020a0389168085529083529281902085905580519485525191937f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925929081900390910190a350600192915050565b6000828211156110a557fe5b50900390565b600160a060020a0382166000908152602081905260409020548111156110d057600080fd5b600160a060020a0382166000908152602081905260409020546110f9908263ffffffff61109916565b600160a060020a038316600090815260208190526040902055600154611125908263ffffffff61109916565b600155604080518281529051600160a060020a038416917fcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5919081900360200190a2604080518281529051600091600160a060020a0385169160008051602061119b8339815191529181900360200190a350505600ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa165627a7a72305820a1e0f5cdc96081f44eea73f352e7ef8fbfbacd306ec0f0b7275c9752d31fbe320029",
    "contractAddress": "0xc944e90c64b2c07662a292be6244bdf05cda44a7",
    "cumulativeGasUsed": "2897211",
    "gasUsed": "1554617",
    "confirmations": "8457626",
    "methodId": "0x60806040",
    "functionName": "atInversebrah(int248 a, uint48[] b, uint32 c, bytes20[] d, bytes30[] e)",
    "trace_address": [
      -1
    ]
  },
  {
    "blockNumber": "11454151",
    "timeStamp": "1607988922",
    "hash": "0x7f218c5d4e9e7b8c0f1cc0009dc7fbbfc0dc03fb36509085075f8678f1b26346",
    "nonce": "218",
    "blockHash": "0x6ec35eb121d926f6147a620315775a52301ece8bad8cf7de049aa710e78e14db",
    "transactionIndex": "79",
    "from": "0x06590a641dc3eb43f2cebe435576389f209116da",
    "to": "0xc944e90c64b2c07662a292be6244bdf05cda44a7",
    "value": "0",
    "gas": "44094",
    "gasPrice": "45000000000",
    "isError": "0",
    "txreceipt_status": "1",
    "input": "0x095ea7b3000000000000000000000000f55041e37e12cd407ad00ce2910b8269b01263b90000000000000000000000000000000000000000000000008ac7230489e80000",
    "contractAddress": "",
    "cumulativeGasUsed": "4881205",
    "gasUsed": "44094",
    "confirmations": "8450244",
    "methodId": "0x095ea7b3",
    "functionName": "approve(address _spender, uint256 _value)",
    "trace_address": [
      -1
    ]
  }
]
const assertions = {
  "0x079625b9f58a40f1948b396b7007d09ff4aa193d7ec798923910fc179294cab8": [
    {
      "method": "not-reverted",
      "args": ""
    }
  ],
  "0x7f218c5d4e9e7b8c0f1cc0009dc7fbbfc0dc03fb36509085075f8678f1b26346": [
    {
      "method": "emit",
      "args": [
        {
          "interface": {
            "fragments": [
              {
                "inputs": [
                  {
                    "internalType": "uint256",
                    "name": "_initialSupply",
                    "type": "uint256"
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
                    "internalType": "address",
                    "name": "account",
                    "type": "address"
                  }
                ],
                "name": "MinterAdded",
                "type": "event"
              },
              {
                "anonymous": false,
                "inputs": [
                  {
                    "indexed": true,
                    "internalType": "address",
                    "name": "account",
                    "type": "address"
                  }
                ],
                "name": "MinterRemoved",
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
                  }
                ],
                "name": "NewOwnership",
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
                  }
                ],
                "name": "NewPendingOwnership",
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
                "name": "acceptOwnership",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "_account",
                    "type": "address"
                  }
                ],
                "name": "addMinter",
                "outputs": [],
                "stateMutability": "nonpayable",
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
                "inputs": [
                  {
                    "internalType": "uint256",
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "burn",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "account",
                    "type": "address"
                  },
                  {
                    "internalType": "uint256",
                    "name": "amount",
                    "type": "uint256"
                  }
                ],
                "name": "burnFrom",
                "outputs": [],
                "stateMutability": "nonpayable",
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
                "inputs": [],
                "name": "governor",
                "outputs": [
                  {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
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
                    "name": "_account",
                    "type": "address"
                  }
                ],
                "name": "isMinter",
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
                    "name": "_to",
                    "type": "address"
                  },
                  {
                    "internalType": "uint256",
                    "name": "_amount",
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
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                  }
                ],
                "name": "nonces",
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
                "name": "pendingGovernor",
                "outputs": [
                  {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "_owner",
                    "type": "address"
                  },
                  {
                    "internalType": "address",
                    "name": "_spender",
                    "type": "address"
                  },
                  {
                    "internalType": "uint256",
                    "name": "_value",
                    "type": "uint256"
                  },
                  {
                    "internalType": "uint256",
                    "name": "_deadline",
                    "type": "uint256"
                  },
                  {
                    "internalType": "uint8",
                    "name": "_v",
                    "type": "uint8"
                  },
                  {
                    "internalType": "bytes32",
                    "name": "_r",
                    "type": "bytes32"
                  },
                  {
                    "internalType": "bytes32",
                    "name": "_s",
                    "type": "bytes32"
                  }
                ],
                "name": "permit",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "_account",
                    "type": "address"
                  }
                ],
                "name": "removeMinter",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
              },
              {
                "inputs": [],
                "name": "renounceMinter",
                "outputs": [],
                "stateMutability": "nonpayable",
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
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "_newGovernor",
                    "type": "address"
                  }
                ],
                "name": "transferOwnership",
                "outputs": [],
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
        "0x06590a641dc3Eb43f2ceBE435576389F209116Da",
        "0xF55041E37E12cD407ad00CE2910B8269B01263b9",
        "0x8ac7230489e80000"
      ]
    },
    {
      "method": "equal",
      "args": "0000000000000000000000000000000000000000000000000000000000000001"
    }
  ]
}
