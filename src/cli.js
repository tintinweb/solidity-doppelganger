#!/usr/bin/env node
'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * 
 * */
const fs = require("fs");
var glob = require("glob");
const path = require('path');
const yargs = require("yargs");
const { SolidityDoppelganger, HASH_MODES } = require('./SolidityDoppelganger');


const options = yargs
    .usage("Usage: -n <name>")
    .option("c", { alias: "compareDb", describe: "compare files with database", type: "boolean", demandOption: false })
    .option("f", { alias: "findDupes", describe: "compare files with each other", type: "boolean", demandOption: false })
    .option("p", { alias: "print", describe: "print processed files to stdout", type: "boolean", demandOption: false })
    .option("d", { alias: "db", describe: "Only print hashes", type: "string", demandOption: false, default: "" })
    .option("b", { alias: "basePath", describe: "Only print hashes", type: "string", demandOption: false, default: "" })
    .option("i", { alias: "ignoreContractName", describe: "Only print hashes", type: "string", demandOption: false })
    .option("m", { alias: "modes", describe: "Only print hashes", type: "string", demandOption: false, default: "AST_EXACT,AST_STRUCTURE" })
    .demandCommand(1, 'Please provide one or more solidity source-code files as arguments.')
    .argv;


function main() {
    if (options.basePath && !options.basePath.endsWith("/")) {
        options.basePath += "/";
    }


    let selectedModes = Array(...new Set(options.modes.split(',').filter(m => HASH_MODES.includes(m))));
    let dupeFinder = new SolidityDoppelganger({ modes: selectedModes });

    options._.forEach(pat => {

        glob.glob(pat, (err, paths) => {
            if (err) {
                console.error(err);
                return;
            }
            paths.map(fpath => {
                if (path.parse(fpath).base.toLowerCase().includes("mock") || path.parse(fpath).base.toLowerCase().includes(".t.") || path.parse(fpath).base.toLowerCase().includes("test")|| path.parse(fpath).base.toLowerCase().includes("migrations")) {
                    return;
                }
                fs.readFile(fpath, (err, data) => {
                    if (err) {
                        console.error(`ERROR processing file '${fpath}': ${err}`);
                        return;
                    }

                    
                    /*
                        print codehashes
                    */
                    if (options.print) {
                        dupeFinder.hashSourceCode(data.toString('utf-8'))
                            .then(results => {
                                results.forEach(x => {
                                    let result = {
                                        name: x.name,
                                        hash: x.hash,
                                        options: x.options,
                                        path: `${options.basePath}${fpath}`
                                    };
                                    console.log(JSON.stringify(result));
                                });
                            });
                    }
                    /*
                        find similar contracts
                    */
                    if (options.compareDb) {
                        dupeFinder.compareSourceCode(data.toString('utf-8'), fpath)
                            .then(results => {
                                Object.keys(results.results).forEach(contractName => {
                                    let resultobj = results.results[contractName];
                                    console.log(`**** MATCH ****: ${resultobj.target.path} :: ${resultobj.target.name}`);
                                    for (let m of resultobj.matches) {
                                        console.log(`    :: ${m.name} :: ${m.path}  (mode=${m.options.mode})`);
                                    }
                                });
                            });
                    }
                });
            });
        });
    });
}

main();