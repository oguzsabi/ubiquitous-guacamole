import { Web3 } from '../node_modules/web3/lib/commonjs/web3';
import * as path from 'path';
import * as fs from 'fs';
import abi from "../src/contracts/compiled/UbiqGuacamoleAbi.json";

const web3 = new Web3("http://127.0.0.1:8545/");

// Read the contract address from the file system
const deployedAddressPath = path.join(__dirname, "UbiqGuacamoleAddress.txt");
const deployedAddress = fs.readFileSync(deployedAddressPath, "utf8");

// Create a new contract object using the ABI and address
const myContract = new web3.eth.Contract(abi, deployedAddress);
myContract.handleRevert = true;

try {
  const subscription = myContract.events.RandomNumberRequested({
    fromBlock: 0,
  });

  subscription.on('data', event => {
    console.log('Event received:', event);
  });

  subscription.on('error', error => {
    console.error('Error:', error);
  });
} catch (error) {}

async function interact() {
  const accounts = await web3.eth.getAccounts();
  const defaultAccount = accounts[0];

  try {
    // Get the current value of 

    // Increment my number
    let receipt = await myContract.methods
      .requestMint()
      .send({
        from: defaultAccount,
        gas: '1000000',
        gasPrice: "10000000000",
      });
    console.log("requestMint() Transaction Hash: " + receipt.transactionHash);


    // Get the updated value of my number
    receipt = await myContract.methods
      .fulfillMint(1)
      .send({
        from: defaultAccount,
        gas: '1000000',
        gasPrice: "10000000000",
      });
    console.log("fulfillMint() Transaction Hash: " + receipt.transactionHash);

    let svg = await myContract.methods
      .generateSVG(1)
      .call();
    console.log("generateSvg():", svg);
  } catch (error) {
    console.error(error);
  }
}

interact();