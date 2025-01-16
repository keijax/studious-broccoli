import { Address, TonClient, toNano } from '@ton/ton';
import { unixNow } from '../lib/utils';
import { MineMessageParams, Queries } from '../wrappers/NftGiver';
import { NetworkProvider } from '@ton/blueprint';

const walletAddress = Address.parse('Wallet_Address');
const collectionAddress = Address.parse('Collection_Address');

// specify endpoint for Testnet
const endpoint = "https://testnet.toncenter.com/api/v2/jsonRPC";

// initialize TON library
const client = new TonClient({ endpoint });

async function mine() {
    try {
        // Fetch mining data from the collection address
        const miningData = await client.runMethod(collectionAddress, 'get_mining_data');

        // Ensure stack is valid
        if (!miningData.stack) {
            throw new Error('Invalid stack data');
        }

        const { stack } = miningData;

        const complexity = stack.readBigNumber();
        const lastSuccess = stack.readBigNumber();
        const seed = stack.readBigNumber();
        const targetDelta = stack.readBigNumber();
        const minCpl = stack.readBigNumber();
        const maxCpl = stack.readBigNumber();

        console.log({ complexity, lastSuccess, seed, targetDelta, minCpl, maxCpl });

        const mineParams: MineMessageParams = {
            expire: unixNow() + 300, // 5 min is enough to make a transaction
            mintTo: walletAddress, // your wallet
            data1: 0n, // temp variable to increment in the miner
            seed // unique seed from get_mining_data
        };
        
        let msg = Queries.mine(mineParams); // transaction builder
        let progress = 0;

        const bufferToBigint = (buffer: Buffer) => BigInt('0x' + buffer.toString('hex'));

        while (bufferToBigint(msg.hash()) > complexity) {
            console.clear()
            console.log(`Mining started: please, wait for 30-60 seconds to mine your NFT!`)
            console.log()
            console.log(`⛏ Mined ${progress} hashes! Last: `, bufferToBigint(msg.hash()))

            mineParams.expire = unixNow() + 300;
            mineParams.data1 += 1n;
            msg = Queries.mine(mineParams);
        }

        console.log()
        console.log('💎 Mission completed: msg_hash less than pow_complexity found!');
        console.log()
        console.log('msg_hash:       ', bufferToBigint(msg.hash()))
        console.log('pow_complexity: ', complexity)
        console.log('msg_hash < pow_complexity: ', bufferToBigint(msg.hash()) < complexity);

        return msg;

    } catch (error) {
        console.error('Error fetching mining data:', error);
    }
}

export async function run(provider: NetworkProvider) {

    const msg = await mine();
    
    await provider.sender().send({
        to: collectionAddress,
        value: toNano(0.05),
        body: msg
    });
}

// Run the mining function
mine();
