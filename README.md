# Crypto Express Chaincode

## Introduction
This repository is part of the CryptoExpress project, which aims to develop a blockchain-based delivery management system using Hyperledger Fabric. The chaincode in this repository is designed to run on the Hyperledger Fabric network and manage the delivery-related operations within the system. The chaincode is implemented in TypeScript using the Fabric Contract API, providing a robust and maintainable solution for delivery management on the blockchain.

[Mocha](https://mochajs.org/) is used to test the chaincode.


## Usage
This repository is the chaincode for the CryptoExpress project. The chaincode is designed to run in a secured Docker container isolated from the endorsing peer process. Chaincode initializes and manages ledger state through transactions submitted by applications. For the network setup and the chaincode deployment, please refer to the [CryptoExpress-Network](https://github.com/Jerrylum/CryptoExpress-Network). For the portal to interact with the network, please refer to the [CryptoExpress-Portal](https://github.com/Jerrylum/CryptoExpress-Portal).

### Development
To develop and test the chaincode locally, you can use the provided scripts to build and test the chaincode:

```bash
# Using node 18.17

# Install dependencies
npm ci

# Build the chaincode
npm run build

# Test the chaincode
npm run test
```

## Project Structure

### DeliveryContract
`DeliveryContract` is a smart contract designed to manage delivery-related operations within a Hyperledger Fabric blockchain network. The contract is built using the Fabric Contract API, which provides a framework for developing chaincode (smart contracts) in TypeScript. The DeliveryContract class extends the Contract class from the Fabric Contract API, inheriting its capabilities to interact with the blockchain ledger.

The contract is structured to handle various delivery management aspects, including route proposals, route submissions, address and courier management, and commitment tracking for delivery progress. It leverages TypeScript's static typing and class-based structure to ensure robustness and maintainability. The contract includes helper functions for CRUD operations on the ledger, such as getAllValues, getValue, putValue, and deleteValue, which interact with the blockchain ledger state.

The DeliveryContract class is annotated with the @Info decorator, providing metadata about the contract, including its title and description.

### Model
`Model` defines a set of types and classes essential for operating a delivery management system within the Hyperledger Fabric blockchain network. The types and classes are designed to model the various entities and operations involved in the delivery process, such as addresses, couriers, goods, routes, and route proposals.

### RouteView
`RouteView` introduces a comprehensive set of classes and types designed to model and visualize the various stages of a delivery route within a blockchain-based delivery management system. The classes and types are structured to represent the intricate details of a delivery process, from the source outgoing to the destination incoming, and encompass the roles of addresses, couriers, goods, and transportation.

### SimpleJSONSerializer
`SimpleJSONSerializer` implements the Serializer interface from the fabric-shim-internal library. It provides a standardized way to serialize and deserialize data for storage and retrieval on the blockchain ledger. It is designed to facilitate the conversion of objects to and from binary format (Buffer) using JSON serialization, making it suitable for storing complex data structures on the blockchain.

### Util
`Util` provides utility functions and cryptographic operations for managing and validating data within a Hyperledger Fabric blockchain application. These are essential for ensuring data integrity, security, and compliance with the blockchain's data, such as the signature of route/commit. 

The general use cases include:
- Object Manipulation: Functions `omitProperty` are used to remove specific properties from objects for data sanitization.
- Validation: Functions `isValidHashIdObject`, `isValidPublicKey`, `isValidUuid`, and `isValidRouteDetail` are designed to validate various types of data, including hash IDs, public keys, UUIDs, and route details.
- Cryptographic Operations: Functions `generateKeyPair` for generating key pairs , `importPublicKey`, `exportPublicKey`, `importPrivateKey`, `exportPrivateKey` for importing and exporting public and private keys , and `signObject`, `verifyObject` for signing and verifying objects.

### generateMetadata
`generateMetadata` is the script to generate and write contract metadata for the chaincode.

## World State Data Storage/Retrieval
In the CryptoExpress project, four types of objects will be maintained in the world state, including:
- route proposal
- submitted route
- public address
- public courier

The objects will be serialized by the `SimpleJSONSerializer` as binary data and released to the world state.

For the world state managed by the chaincode, the serialized data will be mapped with a unique map key for identification and retrieval.
A prefix has been used in the unique map key to help organize and segregate keys logically.
The prefix standard for the prefix of a map key is as follows:
- `rp-`: serialized data for route proposal
- `rt-`: serialized data for submitted route
- `ad-`: serialized data for public address
- `cr-`: serialized data for public courier

Then, the corresponding prefix will combine with a unique identifier (route UUID for route proposal/submitted route, hashID for address/courier) as a unique map key and map with the serialized data in the world state.
