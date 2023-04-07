import Binance from "./binance";
import { EAS, Delegated, ATTEST_TYPE, SchemaEncoder, SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers, utils } from 'ethers';
const { keccak256, toUtf8Bytes, splitSignature } = utils;
import request from "./request";
import { _TypedDataEncoder } from "@ethersproject/hash";
import createMetaMaskProvider from 'metamask-extension-provider';

/*const hash = '0x57fc0a0f2d0fd768be76019da544405c267749679fff47c3e810e7f1381fdaa1';
const sig = '0xeff4d2fe54dfacf17134f57d368c38d036e9539667dcb81ed369a676d98ad7ea6142602455e10b24163691eb0a97027dcbb60591690320380b9ba3f2a109eff300';
const recoveredAddress = ethers.utils.recoverAddress(hash, sig);
console.log('recoveredAddress=', recoveredAddress);
const skaddress = utils.computeAddress('0x8c924d7693ed51e462f1f895d92669d79055ea607a9f3b8658b8794bb2f849ba');
console.log('skaddress=', skaddress);*/

var signer;
var provider;
var addr;
const connectButton = document.querySelector("#connectButton");
connectButton.addEventListener("click", connectMetamask);
async function connectMetamask() {
    const metamaskprovider = createMetaMaskProvider();
    provider = new ethers.providers.Web3Provider(metamaskprovider);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    addr = await signer.getAddress();
    console.log('addr=', addr);
    const labeladdr = document.querySelector("#labeladdr");
    labeladdr.innerHTML = addr;

    // hide the connect button
    connectButton.style.display = "none";
}

const getexdataButton = document.querySelector("#getexdata");
getexdataButton.addEventListener("click", async () => {
    // get the two password inputs
    const apikey = document.querySelector("#password").value;
    const secretKey = document.querySelector("#password2").value;

    // get the result div
    const result = document.querySelector("#result");
    const binance = new Binance ({
        'apiKey': apikey,
        'secretKey': secretKey,
    });
    result.innerHTML = "getting exchange data..."
    try {
      await binance.getInfo();
    } catch {
        alert("Please check your API key and secret key");
        result.innerHTML = "";
        return;
    }
    console.log(binance.totalAccountBalance);
    result.innerHTML = "exchange balace: " + binance.totalAccountBalance;
});

const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26
const eas = new EAS(EASContractAddress);

var izkresponse;
var trueEncodedData;
var falseEncodedData;
var delegated;
var signature;
const izkButton = document.querySelector("#izk");
izkButton.addEventListener("click", async () => {
    if (!provider) {
        alert("Please connect to Metamask first");
        return;
    }
    const result = document.querySelector("#result").innerHTML;
    const resultstr = result.substring("exchange balace: ".length);
    console.log('result=', result);
    const resultNumber = Number(resultstr, 10);
    console.log('resultNumber=', resultNumber);
    if (!resultstr || isNaN(resultNumber)) {
        alert("Please get exchange data first");
        return;
    }
    const resultbool = resultNumber > 100;
    const truehash = await getHash(true);
    const falsehash = await getHash(false);
    
    console.log('truehash=', truehash);
    console.log('falsehash=', falsehash);

    const params = {
        method: 'GET',
        url: 'http://127.0.0.1:8000/get_izk',
        data: {
            basevalue: '100',
            balance: resultstr,
            truehash: truehash,
            falsehash: falsehash
        },
    };
    const izkresult = document.querySelector("#izkresult");
    izkresult.innerHTML = "getting izk proof..."
    try {
        izkresponse = await request(params);
    } catch {
        alert("Please check your izk local client");
        izkresult.innerHTML = "";
        return;
    }
    console.log("izkresponse=", izkresponse);
    const izkres = getQueryRes(izkresponse);
    izkresult.innerHTML = "izk proof: " + izkres.signature;
});
async function getHash(greater) {
    const network = await provider.getNetwork();
    const EAS_CONFIG = {
        address: EASContractAddress,
        version: "0.26",
        chainId: network.chainId,
    };
    delegated = new Delegated(EAS_CONFIG);
    // Initialize SchemaEncoder with the schema string
    const apikey = document.querySelector("#password").value;
    const schemaEncoder = new SchemaEncoder("address address, bytes32 apiKeyHash, string baseValue, bool greaterBaseValue");
    const apikeyhash = keccak256(toUtf8Bytes(apikey));
    console.log('apikeyhash=', apikeyhash);
    const encodedData = schemaEncoder.encodeData([
        { name: "address", value: addr, type: "address" },
        { name: "apiKeyHash", value: apikeyhash, type: "bytes32" },
        { name: "baseValue", value: "100U", type: "string" },
        { name: "greaterBaseValue", value: greater, type: "bool" },
    ]);
    console.log('encodedData=', encodedData);
    if (greater) {
        trueEncodedData = encodedData;
    } else {
        falseEncodedData = encodedData;
    }
    eas.connect(signer);
    const nonce = await eas.getNonce(addr);
    console.log('nonce=', nonce.toNumber());
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
    signature = {
        domain: domain,
        primaryType: "Attest",
        types: types,
        message: value,
        signature: {}
    };

    const typedatahash = _TypedDataEncoder.hash(domain, types, value);
    return typedatahash;
}

const attestButton = document.querySelector("#attest");
attestButton.addEventListener("click", async () => {
    if (!izkresponse) {
        alert("Please get IZK proof first");
        return;
    }
    const izkres = getQueryRes(izkresponse);
    console.log('izkres=', izkres);
    const resgreater = izkres.res;
    console.log('resgreater=', resgreater);
    const resbool = Number(resgreater, 10)? true : false;
    console.log('resbool=', resbool);
    const encodedData = resbool ? trueEncodedData : falseEncodedData;

    /*const encodedData = trueEncodedData;
    const nonce = await eas.getNonce(addr);
    const signaturetest = await delegated.signDelegatedAttestation({
        schema: '0x21007af6c9de7b365fd875e63222491fc88cddac2c239347b4911fb191dcec7f',
        recipient: addr,
        expirationTime: 0,
        revocable: true,
        data: encodedData,
        refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
        nonce: nonce.toNumber(),
    }, signer);
    console.log('signaturetest=', signaturetest);*/

    const rawSignature = izkres.signature;
    const splitsignature = splitSignature(rawSignature);
    signature.message.data = encodedData;
    signature.signature = { v: splitsignature.v, r: splitsignature.r, s: splitsignature.s };
    const verify = delegated.verifyDelegatedAttestationSignature(addr, signature);
    console.log('verify=', verify);
    if (!verify) {
        alert("Please check your izk process");
        return;
    }

    const attestresult = document.querySelector("#attestresult");
    attestresult.innerHTML = "attesting...";

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
    const eascanurl = 'https://sepolia.easscan.org/attestation/view/';
    attestresult.innerHTML = `EAS Scan link: <a target="_blank" href="${eascanurl}"> ${eascanurl}</a>`;
});
function getQueryRes(variable) {
    const params = {};
    var vars = variable.split("&");
    for (var i=0;i<vars.length;i++) {
        var pair = vars[i].split("=");
        params[pair[0]] = pair[1];
    }
    return params;
}


async function sendToChain() {
    //const apikey = document.querySelector("#password").value;
    //const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26
    // Initialize the sdk with the address of the EAS Schema contract address
    //const eas = new EAS(EASContractAddress);

    // Gets a default provider (in production use something else like infura/alchemy)
    //const provider = ethers.providers.getDefaultProvider(
    //  "sepolia"
    //);

    // Connects an ethers style provider/signingProvider to perform read/write functions.
    // MUST be a signer to do write operations!
    //eas.connect(signer);
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
