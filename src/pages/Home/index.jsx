import Binance from "./binance";
import { EAS, Delegated, ATTEST_TYPE, SchemaEncoder, SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers, utils } from 'ethers';
const { keccak256, toUtf8Bytes, splitSignature } = utils;
import request from "./request";
import { _TypedDataEncoder } from "@ethersproject/hash";
import createMetaMaskProvider from 'metamask-extension-provider';

/*const hash = '0x8e19a5d253a4ad07f6f800130ea88f87d88eb05307d763652820770c879b637f';
const sig = '0x9d3c4436561b76aabb8694a48ddd1a75964b6e7f38f28161775ee5233d32d2ed4ac2b54d30b81f9564f67f6df2f67c81f7e1f2f6f668648bb078e022be979c8e01';
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
const attesteraddr = "0x0e2A7B4b143920117f4BD4F4ba5F0912Bb83de08";
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
        url: 'http://192.168.31.105:8000/get_izk',
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
    } catch(error) {
        console.log('error=', error);
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
    const nonce = await eas.getNonce(attesteraddr);
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
    console.log('splitsignature=', splitsignature);
    signature.message.data = encodedData;
    signature.signature = { v: splitsignature.v, r: splitsignature.r, s: splitsignature.s };
    const verify = delegated.verifyDelegatedAttestationSignature(attesteraddr, signature);
    console.log('verify=', verify);
    if (!verify) {
        alert("verify error, Please check your izk process");
        return;
    }

    const attestresult = document.querySelector("#attestresult");
    attestresult.innerHTML = "attesting...";

    var tx;
    try {
        tx = await eas.attestByDelegation({
            schema: "0x21007af6c9de7b365fd875e63222491fc88cddac2c239347b4911fb191dcec7f",
            data: {
                recipient: addr,
                data: encodedData,
                expirationTime: 0,
                revocable: true,
            },
            attester: attesteraddr,
            signature: signature.signature
        });
    } catch(er) {
        alert("attest to eas error, please check params");
        attestresult.innerHTML = "";
        return;
    }
    const newAttestationUID = await tx.wait();
    console.log('newAttestationUID=', newAttestationUID);
    const eascanurl = 'https://sepolia.easscan.org/attestation/view/' + newAttestationUID;
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

