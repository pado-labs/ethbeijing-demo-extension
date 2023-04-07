# PADO EthBeijing Demo

PADO EthBeijing Demo let any user get his balance inlcuding spot account (现货账户) and funding account (资金账户) from Binance exchange. He can prove his  balance is greater than a base value using interactive zero-knowledge proof (IZK). The proved result can be further sent to ethtereum using [EAS](https://attest.sh/) (Ethereum Attestation Service). 

Note this is just a simple demo to introduce the use-case of IZK and attestations. Here are some details for better comprehension.
1. Biance API key and API secret (READ-ONLY priviledge) are required for authentication and authorization purpose to retrieve the user data.
2. The user client performs IZK execution with a verifier which is deployed as a local service. Once the ZK proving and verification completed, the verifier signs on the result (either positive or negtive). The client can send the result encoded as an EAS attestation to ethereum, including: the BOOL result, verifier's signature, and the base value. 

![image](https://user-images.githubusercontent.com/17900089/230559026-b7c539f5-7d75-44b7-8b26-70728c84fbba.png)


## Running

1. Access `chrome://extensions/`
2. Check `Developer mode`
3. Click on `Load unpacked extension`
4. Select the `build` folder.

## About IZK

IZK are a new type of ZKP system which requires a zk-prover and a zk-verifier to interactively communicate with each us, and complete the proving and verification process integrally. The major advantage of IZK protocols are:
* better prover complexity, especially memory-efficiency
* better performance on boolean circuits, and primitives like AES, SHA-256, which are very un-friendly to NIZKs like zk-SNARKs or zk-STARKs.

