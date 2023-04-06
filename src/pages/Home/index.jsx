import Binance from "./binance";
import { EAS, Delegated, ATTEST_TYPE, SchemaEncoder, SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers, utils } from 'ethers';
const { keccak256, toUtf8Bytes } = utils;
import { _TypedDataEncoder } from "@ethersproject/hash";
import createMetaMaskProvider from 'metamask-extension-provider';

const button = document.querySelector("#button");
button.addEventListener("click", async () => {
    // get the two password inputs
    const apikey = document.querySelector("#password").value;
    const secretKey = document.querySelector("#password2").value;

    // get the result div
    const result = document.querySelector("#result");
    const binance = new Binance ({
        'apiKey': apikey,
        'secretKey': secretKey,
    });
    //const balanceFunding  = await binance.getInfo();
    
    //console.log(binance.totalAccountBalance);

    //result.innerHTML = binance.totalAccountBalance;

    await sendToChain();
});

async function sendToChain() {
    const apikey = document.querySelector("#password").value;
    const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26
    // Initialize the sdk with the address of the EAS Schema contract address
    const eas = new EAS(EASContractAddress);

    // Gets a default provider (in production use something else like infura/alchemy)
    //const provider = ethers.providers.getDefaultProvider(
    //  "sepolia"
    //);

    const metamaskprovider = createMetaMaskProvider();
    const provider = new ethers.providers.Web3Provider(metamaskprovider);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const addr = await signer.getAddress();
    console.log('signer=', addr);

    // Connects an ethers style provider/signingProvider to perform read/write functions.
    // MUST be a signer to do write operations!
    eas.connect(signer);
    const network = await provider.getNetwork();
    const EAS_CONFIG = {
        address: EASContractAddress,
        version: "0.26",
        chainId: network.chainId,
    };
    const delegated = new Delegated(EAS_CONFIG);
    // Initialize SchemaEncoder with the schema string
    const schemaEncoder = new SchemaEncoder("address address, bytes32 apiKeyHash, string baseValue, bool greaterBaseValue");
    const apikeyhash = keccak256(toUtf8Bytes(apikey));
    console.log('apikeyhash=', apikeyhash);
    const encodedData = schemaEncoder.encodeData([
        { name: "address", value: addr, type: "address" },
        { name: "apiKeyHash", value: apikeyhash, type: "bytes32" },
        { name: "baseValue", value: "100U", type: "string" },
        { name: "greaterBaseValue", value: true, type: "bool" },
    ]);
    console.log('encodedData=', encodedData);
    const nonce = await eas.getNonce(addr);
    console.log('nonce=', nonce.toNumber());

    /*const signature = await delegated.signDelegatedAttestation({
        schema: '0x21007af6c9de7b365fd875e63222491fc88cddac2c239347b4911fb191dcec7f',
        recipient: addr,
        expirationTime: 0,
        revocable: true,
        data: encodedData,
        refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
        nonce: nonce.toNumber(),
    }, signer);
    console.log('signature=', signature);*/

    /*const verify = delegated.verifyDelegatedAttestationSignature(addr, signature);
    console.log('verify=', verify);*/

    const domain = delegated.getDomainTypedData();
    const types = {
        Attest: ATTEST_TYPE
    };
    const value = {
        schema: '0x21007af6c9de7b365fd875e63222491fc88cddac2c239347b4911fb191dcec7f',
        recipient: addr,
        expirationTime: 0,
        revocable: true,
        data: encodedData,
        refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
        nonce: nonce.toNumber(),
    };

    const typedatahash = _TypedDataEncoder.hash(domain, types, value);
    console.log('typedatahash=', typedatahash);

    /*const newAttestationUID = await eas.attestByDelegation({
        schema: "0x21007af6c9de7b365fd875e63222491fc88cddac2c239347b4911fb191dcec7f",
        data: {
            recipient: addr,
            data: encodedData,
            expirationTime: 0,
            revocable: true,
        },
        attester: addr,
        signature: signature.signature
    });
    console.log('newAttestationUID=', newAttestationUID);*/
}