[<img width="200" alt="get in touch with Consensys Diligence" src="https://user-images.githubusercontent.com/2865694/56826101-91dcf380-685b-11e9-937c-af49c2510aa0.png">](https://diligence.consensys.net)<br/>
<sup>
[[  🌐  ](https://diligence.consensys.net)  [  📩  ](https://github.com/ConsenSys/vscode-solidity-doppelganger/blob/master/mailto:diligence@consensys.net)  [  🔥  ](https://consensys.github.io/diligence/)]
</sup><br/><br/>


# Solidity Doppelgaenger

[🌐](https://www.npmjs.com/package/solidity-doppelganger) `npm install solidity-doppelganger` 

A tool to check if a contract is similar to a set of known/common contracts stored in a DB. E.g. quickly check if a contract `SafeMath` was copied from a reputable source without having to manually check it.

Allows for `strict/exact` and `fuzzy` AST based Doppelgänger detection.

## Example

### Setup

```javascript
// Import
const { SolidityDoppelganger, HASH_MODES } = require('./SolidityDoppelganger');
```

### Input is Solidity SourceCode

```js
// Import: 
const fs = require("fs");

fs.readFile(fpath, (err, data) => {
    if (err) {
        console.error(`ERROR processing file '${fpath}': ${err}`);
        return;
    }
    let selectedModes = Array(...new Set(options.modes.split(',').filter(m => HASH_MODES.includes(m))));
    let dupeFinder = new SolidityDoppelganger({ modes: selectedModes });

    /**
     *  Optionally hash inputs and print them
     * */
    dupeFinder.hashSourceCode(data.toString('utf-8'))
        .then(results =>
            results.forEach(r =>
                r.then(x => {
                    // Result Object
                    let result = {
                        name: x.name,
                        hash: x.hash,
                        options: x.options,
                        path: `${fpath}`
                    };
                    console.log(JSON.stringify(result));
                })
            )
        );

    /**
     * Compare sourceCode with database
     * */
    dupeFinder.compareSourceCode(data.toString('utf-8'), fpath)
        .then(results => {
            Object.keys(results.results).forEach(contractName => {
                // results per contract and path
                let resultobj = results.results[contractName];
                console.log(`**** MATCH ****: ${resultobj.target.path} :: ${resultobj.target.name}`);
                for (let m of resultobj.matches) {
                    console.log(`    :: ${m.name} :: ${m.path}  (mode=${m.options.mode})`);
                }
            });
        });

 });
```

### Input is Contract AST

```javascript
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
if (options.compare) {
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
```