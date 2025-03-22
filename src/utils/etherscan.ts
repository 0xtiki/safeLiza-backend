import axios from 'axios';

interface EtherscanResponse {
  status: string;
  message: string;
  result: string;
}

export async function getContractABI(contractAddress: string): Promise<any[]> {
  
  const apiKey = process.env.ETHERSCAN_API_KEY;

  try {
    const url = `https://api.etherscan.io/api?module=contract&action=getabi&address=${contractAddress}&apikey=${apiKey}`;
    const response = await axios.get<EtherscanResponse>(url);

    if (response.data.status === '1') {
      const abiString = response.data.result;
      const abi = JSON.parse(abiString);
      return abi;
    } else {
      throw new Error(`Failed to fetch ABI: ${response.data.message}`);
    }
  } catch (error) {
    console.error('Error fetching contract ABI:', error);
    throw error;
  }
}
