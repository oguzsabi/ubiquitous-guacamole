const solc = require("solc");
import * as path from 'path';
import * as fs from 'fs';

const contractName = "UbiqGuacamole";
const fileName = `${contractName}.sol`;

// Read the Solidity source code from the file system
const contractPath = path.join(__dirname, 'contracts', fileName);
const sourceCode = fs.readFileSync(contractPath, 'utf8');

// Function to find imports
function findImports(importPath: string) {
  // First, try to resolve the import path relative to the current contract
  let fullPath = path.resolve(path.dirname(contractPath), importPath);

  if (!fs.existsSync(fullPath)) {
    // If not found, try to resolve from node_modules
    fullPath = path.resolve(__dirname, '..', 'node_modules', importPath);
  }


  if (!fs.existsSync(fullPath)) {
    return { error: 'File not found' };
  }

  return {
    contents: fs.readFileSync(fullPath, 'utf8')
  };
}

// solc compiler config
const input = {
  language: 'Solidity',
  sources: {
    [fileName]: {
      content: sourceCode,
    },
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*'],
      },
    },
  },
};

// Compile the Solidity code using solc
const compiledCode = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

console.log(compiledCode);

// Check for errors
if (compiledCode.errors) {
  compiledCode.errors.forEach((error: any) => {
    console.error(error.formattedMessage);
  });
}

// Get the bytecode from the compiled contract
const bytecode = compiledCode.contracts[fileName][contractName].evm.bytecode.object;

// Write the bytecode to a new file
const bytecodePath = path.resolve(__dirname, 'contracts', 'compiled', `${contractName}Bytecode.bin`);

fs.writeFileSync(bytecodePath, bytecode);

// Log the compiled contract code to the console
console.log("Contract Bytecode:\n", bytecode);

// Get the ABI from the compiled contract
const abi = compiledCode.contracts[fileName][contractName].abi;

// Write the Contract ABI to a new file
const abiPath = path.resolve(__dirname, 'contracts', 'compiled', `${contractName}Abi.json`);
fs.writeFileSync(abiPath, JSON.stringify(abi, null, "\t"));

// Log the Contract ABI to the console
console.log("Contract ABI:\n", abi);