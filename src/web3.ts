import 'dotenv/config';
import { Web3 } from '../node_modules/web3/lib/commonjs/web3';

const web3 = new Web3(process.env.WEB3_PROVIDER_URL);

const getChainId = async () => {
  const chainId: bigint = await web3.eth.getChainId();

  console.log(`Chain ID: ${chainId}`);

  return chainId;
}

getChainId();
