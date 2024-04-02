# Crypto Express Chaincode

## Introduction
This is a repository for the chaincode and its used components for the project CryptoExpress. The standard of the chaincode is based on [Hyperledger Fabric](https://github.com/hyperledger/fabric). 

All script in this repository has been already tested under [Mocha](https://mochajs.org/), the test script for each component of chaincode has been named with postfix `.spec`.

## Usage
This repository only includes the chaincode for sharing with the peer in the network, the actual use case require to install both [CryptoExpress-Portal](https://github.com/Jerrylum/CryptoExpress-Portal) and [CryptoExpress-Network](https://github.com/Jerrylum/CryptoExpress-Network). The detail of Installation and the Glossary can be accessed via the [Readme at CryptoExpress-Portal](https://github.com/Jerrylum/CryptoExpress-Portal/blob/main/README.md).

## Script Description

### DeliveryContract
`DeliveryContract` is a smart contract designed for managing delivery-related operations within a Hyperledger Fabric blockchain network. The contract is built using the Fabric Contract API, which provides a framework for developing chaincode (smart contracts) in TypeScript. The DeliveryContract class extends the Contract class from the Fabric Contract API, inheriting its capabilities to interact with the blockchain ledger.

The contract is structured to handle various aspects of delivery management, including route proposals, route submissions, address and courier management, and commitment tracking for delivery progress. It leverages TypeScript's static typing and class-based structure to ensure robustness and maintainability. The contract includes helper functions for CRUD operations on the ledger, such as getAllValues, getValue, putValue, and deleteValue, which are used to interact with the blockchain ledger state.

The DeliveryContract class is annotated with the @Info decorator, providing metadata about the contract, including its title and description.

### Model
`Model` defines a set of types and classes that are essential for the operation of a delivery management system within the Hyperledger Fabric blockchain network. The types and classes are designed to model the various entities and operations involved in the delivery process, such as addresses, couriers, goods, routes, and route proposals.

### RouteView
`RouteView` introduces a comprehensive set of classes and types designed to model and visualize the various stages of a delivery route within a blockchain-based delivery management system. The classes and types are structured to represent the intricate details of a delivery process, from the source outgoing to the destination incoming, and encompass the roles of addresses, couriers, goods, and the transportation of goods.

### SimpleJSONSerializer
`SimpleJSONSerializer` implements the Serializer interface from the fabric-shim-internal library. It providing a standardized way to serialize and deserialize data for storage and retrieval on the blockchain ledger. It is designed to facilitate the conversion of objects to and from binary format (Buffer) using JSON serialization, making it suitable for storing complex data structures on the blockchain.

### Util
`Util` provides a collection of utility functions and cryptographic operations for managing and validating data within a Hyperledger Fabric blockchain application, which are essential for ensuring data integrity, security, and compliance with the blockchain's data such as signature of route/commit. 

The general use cases including:
- Object Manipulation: Functions `omitProperty` are used to remove specific properties from objects, for data sanitization.
- Validation: Functions `isValidHashIdObject`, `isValidPublicKey`, `isValidUuid`, and `isValidRouteDetail` are designed to validate various types of data, including hash IDs, public keys, UUIDs, and route details.
- Cryptographic Operations: Functions `generateKeyPair` for generating key pairs , `importPublicKey`, `exportPublicKey`, `importPrivateKey`, `exportPrivateKey` for importing and exporting public and private keys , and `signObject`, `verifyObject` for signing and verifying objects.

### index
`index` is the configuration script for register the custom serializer `SimpleJSONSerializer` for the chaincode.

### generateMetadata
`generateMetadata` is the script to generate and write contract metadata for the chaincode.
