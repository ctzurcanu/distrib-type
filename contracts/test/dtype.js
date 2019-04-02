const dType = artifacts.require('dType.sol')
const testUtils = artifacts.require('TestUtils.sol')

const insertsBase = require('../data/dtypes_test.json');

let insertFunction = {
    name: 'add',
    types: [
        {name: "uint256", label: "a", relation:0},
        {name: "uint256", label: "b", relation:0},
    ],
    lang: 0,
    typeChoice: 4,
    contractAddress: '0xCd9492Cdae7E8F8B5a648c6E15c4005C4cd9028b',
    source: '0x0000000000000000000000000000000000000000000000000000000000000000',
    outputs: [
        {name: "uint256", label: "result", relation:0},
    ]
}

contract('dType', async (accounts) => {
    let dtypeContract, testUtilsContract;
    let typeHashes = [];

    it('deploy', async () => {
        dtypeContract = await dType.deployed({from: accounts[0]});
        testUtilsContract = await testUtils.deployed({from: accounts[0]});
    });

    it('signature', async () => {
        let isArray, functionRecord, fhash;
        let signature, signatureTest, hash, typeSignature;

        isArray = await dtypeContract.typeIsArray("[]");
        assert.equal(isArray, true);

        isArray = await dtypeContract.typeIsArray("TypeA[]");
        assert.equal(isArray, true);

        isArray = await dtypeContract.typeIsArray("string[]l");
        assert.equal(isArray, false);

        hash = await dtypeContract.getTypeHash(0, 'TypeA');
        typeSignature = await dtypeContract.getTypeSignature(hash);
        assert.equal(typeSignature, '(uint256,address)');

        hash = await dtypeContract.getTypeHash(0, 'TypeA[]');
        typeSignature = await dtypeContract.getTypeSignature(hash);
        assert.equal(typeSignature, '(uint256,address)[]');

        functionRecord = JSON.parse(JSON.stringify(insertFunction)); functionRecord.name = 'newF1';
        functionRecord.types = [
            {name: "string[]", label: "label", relation:0},
        ];
        await dtypeContract.insert(functionRecord);
        fhash = await dtypeContract.getTypeHash(0, 'newF1');
        signature = await dtypeContract.getSignature(fhash);
        signatureTest = await testUtilsContract.getSignature('newF1(string[])');
        assert.equal(signature, signatureTest, `newF1 signatures are not equal`);

        functionRecord = JSON.parse(JSON.stringify(insertFunction)); functionRecord.name = 'newF2';
        functionRecord.types = [
            {name: "TypeA[]", label: "label", relation:0},
        ];
        await dtypeContract.insert(functionRecord);
        fhash = await dtypeContract.getTypeHash(0, 'newF2');

        signature = await dtypeContract.getSignature(fhash);
        signatureTest = await testUtilsContract.getSignature('newF2((uint256,address)[])');
        assert.equal(signature, signatureTest, `newF2 signatures are not equal`);
    });

    it('insert', async () => {
        for (let i = 0; i < insertsBase.length; i++) {
            let dtype, typeHash, typesOnChain;

            typeHash = await dtypeContract.getTypeHash(insertsBase[i].lang, insertsBase[i].name);
            dtype = await dtypeContract.get(insertsBase[i].lang, insertsBase[i].name);
            sameStructs(insertsBase[i], dtype.data);

            assert.sameMembers(dtype.data.types, insertsBase[i].types, 'unexpected types');
            typeHashes.push(typeHash);
        }
    });

    it('insertFunction', async () => {
        let dtype, typeHash, typeOutputs;

        await dtypeContract.insert(insertFunction, {from: accounts[0]});

        typeHash = await dtypeContract.getTypeHash(insertFunction.lang, insertFunction.name);
        await dtypeContract.setOptionals(typeHash, insertFunction.outputs);

        dtype = await dtypeContract.get(insertFunction.lang, insertFunction.name);
        typeOutputs = await dtypeContract.getOptionals(typeHash);
        dtype.data.outputs = typeOutputs;
        sameStructs(insertFunction, dtype.data);

        let signature = await dtypeContract.getSignature(typeHash);
        let functionName = `${insertFunction.name}(${
            insertFunction.types.map(type => type.name).join(',')
        })`;
        let signatureTest = await testUtilsContract.getSignature(functionName);
        assert.equal(signature, signatureTest, `Signatures are not equal`);
    });

    it('update', async () => {
        let dtype;
        let newdType = Object.assign({}, insertsBase[0]);
        newdType.name = 'newname';
        newdType.types = [
            {name: insertsBase[1].name, label: "label", relation:0},
        ];

        await dtypeContract.update(typeHashes[0], newdType, {from: accounts[0]});

        dtype = await dtypeContract.get(newdType.lang, newdType.name);
        sameStructs(newdType, dtype.data);
    });

    it('remove', async () => {
        let typeHash;

        typeHash = await dtypeContract.getTypeHash(insertsBase[2].lang, insertsBase[2].name);
        assert.isOk(await dtypeContract.isType(typeHash), 'no dtype to remove');

        await dtypeContract.remove(typeHash);
        assert.isNotOk(await dtypeContract.isType(typeHash), 'dtype was not removed');
    });
});

function sameStructs(shouldBe, current) {
    Object.keys(shouldBe)
        .filter(key => !Number(key) && Number(key) != 0)
        .forEach((key) => {
            if (shouldBe[key] instanceof Array) {
                sameStructs(shouldBe[key], current[key]);
            } else {
                assert.equal(
                    current[key],
                    shouldBe[key],
                    `wrong ${key}, should be ${shouldBe[key]} instead of ${current[key]}`,
                );
            }
        });
}
