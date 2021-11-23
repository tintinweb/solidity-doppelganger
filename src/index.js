'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * 
 * */

/*
Example:

const {SolidityDoppelganger} = require('solidity-doppelganger');

let dupeFinder = new SolidityDoppelganger({database:"./mydatabase"});
dupeFinder.check(text);
 */

const { SolidityDoppelganger, JsonDb, HASH_MODES, AstHashedContract, AstHashCompareResults, AstHashedContractSync } = require('./SolidityDoppelganger');

module.exports = {
    SolidityDoppelganger,
    JsonDb,
    HASH_MODES,
    AstHashCompareResults,
    AstHashedContract,
    AstHashedContractSync
};