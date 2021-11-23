'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * 
 * */
const parser = require('@solidity-parser/parser');
const crypto = require('crypto');
const fs = require("fs");

function hash(content, algorithm) {
    return crypto.createHash(algorithm).update(content).digest('hex');
}

class JsonDb {

    constructor() {
        this.db = [];
    }

    loadDefault() {
        fs.readdirSync(`${__dirname}/dbdata`).filter(f => f.endsWith(".json")).forEach(f => this.load(`${__dirname}/dbdata/${f}`));
        return this;
    }

    load(fpath) {
        this.db = this.db.concat(this.readJsonLines(fs.readFileSync(fpath, { encoding: 'utf8', flag: 'r' })));
        return this;
    }

    readJsonLines(string) {
        return string.split('\n').filter(line => line).map(line => line.trim()).map(line => JSON.parse(line));
    }

    filter(f) {
        if (typeof (f) === "string") {
            return this.db.filter(e => e.hash === f);
        }
        return this.db.filter(f);
    }
}



class SolidityDoppelganger {

    constructor(options) {
        this.options = options || {};
        if(this.options.db){
            this.db = options.db;
            delete this.options.db;
        } else {
            this.db = new JsonDb().loadDefault();
        }
        this.options.modes = this.options.modes || HASH_MODES;
        
    }

    /**
     * Return a list of HashedContract Object promises
     * @param {string} sourceCode 
     */
    async hashSourceCode(sourceCode, fpath) {
        const sourceUnit = this._parse(sourceCode);
        return await this.hashSourceUnit(sourceUnit, fpath);
    }

    /**
     * Check provided sourceCode for known contracts
     * @param {string} sourceCode 
     */
    async compareSourceCode(sourceCode, fpath) {
        let astHashedContracts = await Promise.all(await this.hashSourceCode(sourceCode, fpath));
        return this._compareHashedContracts(astHashedContracts);
    }

    async compareContractAst(contractAstNode, fpath) {
        let astHashedContracts = await Promise.all(await this.hashContract(contractAstNode, fpath));
        return this._compareHashedContracts(astHashedContracts);
    }

    _compareHashedContracts(astHashedContracts) {
        let targetHashes = astHashedContracts.map(ahc => ahc.hash);

        //prefilter: any matches
        let dbmatches = this.db.filter(dbelem => targetHashes.includes(dbelem.hash)); //prefilter: any matches
        let dbmatchesHashes = dbmatches.map(m => m.hash);

        let results = new AstHashCompareResults();
        for (let target of astHashedContracts.filter(ahc => dbmatchesHashes.includes(ahc.hash))) {
            //target is a match            
            results.addResult(target, dbmatches.filter(dbe => target.hash === dbe.hash && target.options.algorithm == dbe.options.algorithm && target.options.mode === dbe.options.mode));
        }
        return results;
    }

    /*
     * hashing 
     */
    async hashSourceUnit(sourceUnit, fpath) {
        let astHashedContracts = []; // .. AstHashedContract

        if (!sourceUnit || sourceUnit.type !== 'SourceUnit') {
            throw new Error("Not a valid SourceUnit type");
        }
        sourceUnit = JSON.parse(JSON.stringify(sourceUnit)); //fast-clone object
        let contracts = this.getContractDefinitions(sourceUnit);

        for(let mode of this.options.modes){
            for(let contract of contracts){
                    let options = { ...this.options };
                    delete options.modes;
                    options.mode = mode;
                    astHashedContracts.push(await (new AstHashedContract(options, fpath).fromAst(contract)));
            }
        }
        return astHashedContracts;
    }

    getContractDefinitions(sourceUnit) {
        if (!sourceUnit || sourceUnit.type !== 'SourceUnit') {
            throw new Error("Not a valid SourceUnit type");
        }
        return sourceUnit.children.filter(n => n.type === "ContractDefinition");
    }

    async hashContract(astContract, fpath) {
        let astHashedContracts = []; // .. AstHashedContract

        if (!astContract || astContract.type !== 'ContractDefinition') {
            throw new Error("Not a valid SourceUnit type");
        }
        astContract = JSON.parse(JSON.stringify(astContract)); //fast-clone object
        for(let mode of this.options.modes){
            let options = { ...this.options };
            delete options.modes;
            options.mode = mode;
            astHashedContracts.push(await (new AstHashedContract(options, fpath).fromAst(astContract)));
        }
        return astHashedContracts;
    }

    /*
    * parser
    */
    _parse(sourceCode) {
        var ast = parser.parse(sourceCode, { loc: false, tolerant: true });
        return ast;
    }
}


class AstHashedContract {

    constructor(options, fpath) {
        this.options = {
            algorithm: "sha1",
            mode: undefined,
            ...options
        };
        this.name = undefined;
        this.contract = {
            kind: undefined,
            baseContracts: []
        };
        this.typeDeclarations = []; // Events, Structs, usingFors
        this.stateVars = [];
        this.functions = [];
        this.hash = undefined;
        this.path = fpath;

    }

    hashAst(node) {
        switch (this.options.mode) {
            case 'AST_STRUCTURE':
                return this._hashJsonFuzzy(node);
            case 'AST_EXACT':
                //default:
                return this._hashJsonExact(node);
        }
        throw new Error("Invalid HashMode");
    }

    async _hashJsonFuzzy(node) {
        parser.visit(node, {
            ContractDefinition: (node) => {
                node.name = "";
            },
            FunctionDefinition: (node) => {
                node.name = "";
            },
            ModifierDefinition: (node) => {
                node.name = "";
            },
            EventDefinition: (node) => {
                node.name = "";
                node.isAnonymous = null;
            },
            StructDefinition: (node) => {
                node.name = "";
            },
            UsingForDeclaration: (node) => {
                node.libraryName = "";
            },
            VariableDeclaration: (node) => {
                node.name = "";
                node.isIndexed = false;
            },
            UserDefinedTypeName: (node) => {
                node.name = "";
                if (typeof (node.namePath) === "string") {
                    node.namePath = "";
                }
            },
            ElementaryTypeName: (node) => {
                node.name = "";
            },
            Identifier: (node) => {
                node.name = "";
            },
            MemberAccess: (node) => {
                node.name = "";
                node.memberName = "";
            },
            FunctionCall: (node) => {
                if (node.expression && node.expression.type === "Identifier" && ["require", "assert"].includes(node.expression.name)) {
                    //remove assertion texts
                    node.arguments.filter(n => n.type == "StringLiteral").forEach(n => n.value = "");
                }
            }
        });

        //

        // 2) sort by type
        let beforeChildren = node.subNodes.length;
        let nodeTypeMapping = {};

        for (let n of node.subNodes) {
            let type = n.type;
            if (nodeTypeMapping[type] === undefined) {
                nodeTypeMapping[type] = [];
            }
            nodeTypeMapping[type].push(n);
        }
        //clear the statespace
        node.subNodes = [];
        
        //readd - hashes only?
        for (let ntype of Object.keys(nodeTypeMapping).sort()) {
            let elems = nodeTypeMapping[ntype];
            //sorted by type
            let that = this;
            if(ntype === "StructDefinition"){
                //make sure struct elements position independent
                for(let struct of elems){
                    if(!struct.members) continue;
                    let hashedStructMembers = [];
                    for(let sm of struct.members){
                        hashedStructMembers.push(await that._hashJsonExact(sm));
                    }
                    struct.members = hashedStructMembers.sort();
                }
            }
            //add sub-hashes 
            for (let sn of elems){
                node.subNodes.push(await this._hashJsonExact(sn));
            }
        }
        node.subNodes.sort();
        if (node.subNodes.length !== beforeChildren){
            throw new Error("Assertion Failed: node.subNodes.length !== beforeChildren");
        }
        return this._hashJsonExact(node);
    }

    async _hashJsonExact(node) {
        return hash(JSON.stringify(node), this.options.algorithm);
    }

    async fromAst(node) {
        if (node.type !== "ContractDefinition") {
            throw new Error("Not a valid ContractDefinition");
        }
        /**
         * process contract information
         */
        this.name = node.name;
        this.contract.kind = node.kind;
        this.contract.baseContracts = node.baseContracts
            .filter(b => b.type === 'InheritanceSpecifier')
            .map(b => {
                /*
                baseName: { type: 'UserDefinedTypeName', namePath: 'Ownable' },
                arguments: [
                    { type: 'NumberLiteral', number: '1', subdenomination: null },
                    { type: 'NumberLiteral', number: '2', subdenomination: null }
                ]
                */
                return { name: b.baseName, arguments: b.arguments };
            });
        /**
         * process contract.typeDeclarations
         */
        for (let sn of node.subNodes) {
            switch (sn.type) {
                case 'FunctionDefinition':
                case 'ModifierDefinition':
                    this.functions.push(sn);
                    break;
                case 'StateVariableDeclaration':
                    this.stateVars.push(sn);
                    break;
                default:
                    //type declarations (struct, event, ...)
                    this.typeDeclarations.push(sn);
                    break;
            }
        }
        this.hash = await this.hashAst(node);
        return this;
    }
}

class AstHashedContractSync {

    constructor(options, fpath) {
        this.options = {
            algorithm: "sha1",
            mode: undefined,
            ...options
        };
        this.name = undefined;
        this.contract = {
            kind: undefined,
            baseContracts: []
        };
        this.typeDeclarations = []; // Events, Structs, usingFors
        this.stateVars = [];
        this.functions = [];
        this.hash = undefined;
        this.path = fpath;

    }

    hashAst(node) {
        switch (this.options.mode) {
            case 'AST_STRUCTURE':
                return this._hashJsonFuzzy(node);
            case 'AST_EXACT':
                //default:
                return this._hashJsonExact(node);
        }
        throw new Error("Invalid HashMode");
    }

    _hashJsonFuzzy(node) {
        parser.visit(node, {
            ContractDefinition: (node) => {
                node.name = "";
            },
            FunctionDefinition: (node) => {
                node.name = "";
            },
            ModifierDefinition: (node) => {
                node.name = "";
            },
            EventDefinition: (node) => {
                node.name = "";
                node.isAnonymous = null;
            },
            StructDefinition: (node) => {
                node.name = "";
            },
            UsingForDeclaration: (node) => {
                node.libraryName = "";
            },
            VariableDeclaration: (node) => {
                node.name = "";
                node.isIndexed = false;
            },
            UserDefinedTypeName: (node) => {
                node.name = "";
                if (typeof (node.namePath) === "string") {
                    node.namePath = "";
                }
            },
            ElementaryTypeName: (node) => {
                node.name = "";
            },
            Identifier: (node) => {
                node.name = "";
            },
            MemberAccess: (node) => {
                node.name = "";
                node.memberName = "";
            },
            FunctionCall: (node) => {
                if (node.expression && node.expression.type === "Identifier" && ["require", "assert"].includes(node.expression.name)) {
                    //remove assertion texts
                    node.arguments.filter(n => n.type == "StringLiteral").forEach(n => n.value = "");
                }
            }
        });

        //

        // 2) sort by type
        let beforeChildren = node.subNodes.length;
        let nodeTypeMapping = {};

        for (let n of node.subNodes) {
            let type = n.type;
            if (nodeTypeMapping[type] === undefined) {
                nodeTypeMapping[type] = [];
            }
            nodeTypeMapping[type].push(n);
        }
        //clear the statespace
        node.subNodes = [];
        
        //readd - hashes only?
        for (let ntype of Object.keys(nodeTypeMapping).sort()) {
            let elems = nodeTypeMapping[ntype];
            //sorted by type
            let that = this;
            if(ntype === "StructDefinition"){
                //make sure struct elements position independent
                for(let struct of elems){
                    if(!struct.members) continue;
                    let hashedStructMembers = [];
                    for(let sm of struct.members){
                        hashedStructMembers.push(that._hashJsonExact(sm));
                    }
                    struct.members = hashedStructMembers.sort();
                }
            }
            //add sub-hashes 
            for (let sn of elems){
                node.subNodes.push(this._hashJsonExact(sn));
            }
        }
        node.subNodes.sort();
        if (node.subNodes.length !== beforeChildren){
            throw new Error("Assertion Failed: node.subNodes.length !== beforeChildren");
        }
        return this._hashJsonExact(node);
    }

    _hashJsonExact(node) {
        return hash(JSON.stringify(node), this.options.algorithm);
    }

    fromAst(node) {
        if (node.type !== "ContractDefinition") {
            throw new Error("Not a valid ContractDefinition");
        }
        /**
         * process contract information
         */
        this.name = node.name;
        this.contract.kind = node.kind;
        this.contract.baseContracts = node.baseContracts
            .filter(b => b.type === 'InheritanceSpecifier')
            .map(b => {
                /*
                baseName: { type: 'UserDefinedTypeName', namePath: 'Ownable' },
                arguments: [
                    { type: 'NumberLiteral', number: '1', subdenomination: null },
                    { type: 'NumberLiteral', number: '2', subdenomination: null }
                ]
                */
                return { name: b.baseName, arguments: b.arguments };
            });
        /**
         * process contract.typeDeclarations
         */
        for (let sn of node.subNodes) {
            switch (sn.type) {
                case 'FunctionDefinition':
                case 'ModifierDefinition':
                    this.functions.push(sn);
                    break;
                case 'StateVariableDeclaration':
                    this.stateVars.push(sn);
                    break;
                default:
                    //type declarations (struct, event, ...)
                    this.typeDeclarations.push(sn);
                    break;
            }
        }
        this.hash = this.hashAst(node);
        return this;
    }
}


const HASH_MODES = ["AST_EXACT", "AST_STRUCTURE"];


class AstHashCompareResults {
    constructor() {
        this.results = {};
    }

    addResult(target, result) {
        let key = `${target.path || ""}::${target.name}`;
        if (typeof (this.results[key]) === "undefined") {
            this.results[key] = { target: target, matches: [] };
        }
        this.results[key].matches = this.results[key].matches.concat(result);
    }
}

module.exports = {
    SolidityDoppelganger: SolidityDoppelganger,
    JsonDb: JsonDb,
    HASH_MODES: HASH_MODES,
    AstHashedContract,
    AstHashCompareResults,
    AstHashedContractSync
};

