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

const { SolidityDoppelganger, JsonDb, HASH_MODES } = require('./SolidityDoppelganger');

module.exports = {
    SolidityDoppelganger: SolidityDoppelganger,
    JsonDb: JsonDb,
    HASH_MODES: HASH_MODES
};