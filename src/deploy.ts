import { Web3 } from '../node_modules/web3/lib/commonjs/web3';
import * as path from 'path';
import * as fs from 'fs';
import abi from "../src/contracts/compiled/UbiqGuacamoleAbi.json";

const web3 = new Web3("http://127.0.0.1:8545/");

const bytecodePath = path.join(__dirname, 'contracts', 'compiled', "UbiqGuacamoleBytecode.bin");
const bytecode = fs.readFileSync(bytecodePath, "utf8");

const ubiqGuacamole = new web3.eth.Contract(abi);
ubiqGuacamole.handleRevert = true;

async function deploy() {
  const providersAccounts = await web3.eth.getAccounts();
  const defaultAccount = providersAccounts[0];
  console.log("Deployer account:", defaultAccount);

  const contractDeployer = ubiqGuacamole.deploy({
    data: "0x" + bytecode,
    arguments: [defaultAccount],
  });

  const gas = await contractDeployer.estimateGas({
    from: defaultAccount,
  });
  console.log("Estimated gas:", gas);

  try {
    const tx = await contractDeployer.send({
      from: defaultAccount,
      gas: String(gas),
      gasPrice: '10000000000',
    });
    console.log("Contract deployed at address: " + tx.options.address);

    const deployedAddressPath = path.join(__dirname, "UbiqGuacamoleAddress.txt");
    fs.writeFileSync(deployedAddressPath, tx.options?.address ?? 'Contract deployment failed');
  } catch (error) {
    console.error(error);
  }
}

deploy();