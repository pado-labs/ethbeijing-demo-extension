import Binance from "./binance";
import { EAS, Delegated, ATTEST_TYPE, SchemaEncoder, SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers, utils } from 'ethers';
const { keccak256, toUtf8Bytes, splitSignature } = utils;
import request from "./request";
import { _TypedDataEncoder } from "@ethersproject/hash";
import createMetaMaskProvider from 'metamask-extension-provider';
import './index.css'

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
const schemauid = "0x8341b4c86f98079befe804ccdbdf9d58f34a424c92582561010e8721dfa1e771";
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
    const izkresult = document.querySelector("#izkresult");
    izkresult.innerHTML = "getting izk proof..."
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
    const schemaEncoder = new SchemaEncoder("bytes32 apiKeyHash, string baseValue, bool greaterThanBaseValue");
    const apikeyhash = keccak256(toUtf8Bytes(apikey));
    console.log('apikeyhash=', apikeyhash);
    const encodedData = schemaEncoder.encodeData([
        { name: "apiKeyHash", value: apikeyhash, type: "bytes32" },
        { name: "baseValue", value: "100U", type: "string" },
        { name: "greaterThanBaseValue", value: greater, type: "bool" },
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
        schema: schemauid,
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
            schema: schemauid,
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

