const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const MerkleTreeBridge = require('@0xpolygonhermez/zkevm-commonjs').MTBridge;
const {
    verifyMerkleProof,
    getLeafValue,
} = require('@0xpolygonhermez/zkevm-commonjs').mtBridgeUtils;

function calculateGlobalExitRoot(mainnetExitRoot, rollupExitRoot) {
    return ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [mainnetExitRoot, rollupExitRoot]);
}
/* eslint-disable no-await-in-loop */

describe('PolygonZkEVMBridge bridgeAsset Gas Consumption', () => {
    let deployer;
    let rollup;
    let acc1;

    let polygonZkEVMGlobalExitRoot;
    let polygonZkEVMBridgeContract;
    let tokenContract;

    const tokenName = 'Matic Token';
    const tokenSymbol = 'MATIC';
    const decimals = 18;
    const tokenInitialBalance = ethers.utils.parseEther('20000000');
    const metadataToken = ethers.utils.defaultAbiCoder.encode(
        ['string', 'string', 'uint8'],
        [tokenName, tokenSymbol, decimals],
    );

    const networkIDMainnet = 0;
    const networkIDRollup = 1;

    const LEAF_TYPE_ASSET = 0;
    // const LEAF_TYPE_MESSAGE = 1;

    const polygonZkEVMAddress = ethers.constants.AddressZero;

    beforeEach('Deploy contracts', async () => {
        // load signers
        [deployer, rollup, acc1] = await ethers.getSigners();

        // deploy PolygonZkEVMBridge
        const polygonZkEVMBridgeFactory = await ethers.getContractFactory('PolygonZkEVMBridge');
        polygonZkEVMBridgeContract = await upgrades.deployProxy(polygonZkEVMBridgeFactory, [], { initializer: false });

        // deploy global exit root manager
        const PolygonZkEVMGlobalExitRootFactory = await ethers.getContractFactory('PolygonZkEVMGlobalExitRoot');
        polygonZkEVMGlobalExitRoot = await PolygonZkEVMGlobalExitRootFactory.deploy(rollup.address, polygonZkEVMBridgeContract.address);

        await polygonZkEVMBridgeContract.initialize(networkIDMainnet, polygonZkEVMGlobalExitRoot.address, polygonZkEVMAddress);

        // deploy token
        const maticTokenFactory = await ethers.getContractFactory('ERC20PermitMock');
        tokenContract = await maticTokenFactory.deploy(
            tokenName,
            tokenSymbol,
            deployer.address,
            tokenInitialBalance,
        );
        await tokenContract.deployed();
    });

    it('ETH bridge with false forceUpdateGlobalExitRoot', async () => {
        const amount = '0.01';
        for (let i = 0; i < 2000; i++) {
            await polygonZkEVMBridgeContract.bridgeAsset(
                networkIDRollup,
                deployer.address,
                ethers.utils.parseEther(amount),
                '0x0000000000000000000000000000000000000000',
                false,
                '0x',
                {
                    value: ethers.utils.parseEther(amount),
                },
            );
        }
    });

    it('ETH bridge with true forceUpdateGlobalExitRoot', async () => {
        const amount = '0.01';
        for (let i = 0; i < 1000; i++) {
            await polygonZkEVMBridgeContract.bridgeAsset(
                networkIDRollup,
                deployer.address,
                ethers.utils.parseEther(amount),
                '0x0000000000000000000000000000000000000000',
                true,
                '0x',
                {
                    value: ethers.utils.parseEther(amount),
                },
            );
        }
    });

    it('ERC20 bridge with false forceUpdateGlobalExitRoot', async () => {
        const originNetwork = networkIDMainnet;
        const tokenAddress = tokenContract.address;
        const amount = ethers.utils.parseEther('1');
        const destinationNetwork = networkIDRollup;
        const destinationAddress = deployer.address;
        const metadata = metadataToken;
        let localDepositCount = await polygonZkEVMBridgeContract.depositCount();

        for (let i = 0; i < 10; i++) {
            await expect(tokenContract.approve(polygonZkEVMBridgeContract.address, amount))
                .to.emit(tokenContract, 'Approval')
                .withArgs(deployer.address, polygonZkEVMBridgeContract.address, amount);

            await expect(polygonZkEVMBridgeContract.bridgeAsset(
                destinationNetwork,
                destinationAddress,
                amount,
                tokenAddress,
                false,
                '0x',
            ))
                .to.emit(polygonZkEVMBridgeContract, 'BridgeEvent')
                .withArgs(
                    LEAF_TYPE_ASSET,
                    originNetwork,
                    tokenAddress,
                    destinationNetwork,
                    destinationAddress,
                    amount,
                    metadata,
                    localDepositCount,
                );

            localDepositCount = await polygonZkEVMBridgeContract.depositCount();
        }
    });

    it('ERC20 bridge with true forceUpdateGlobalExitRoot', async () => {
        const originNetwork = networkIDMainnet;
        const tokenAddress = tokenContract.address;
        const amount = ethers.utils.parseEther('1');
        const destinationNetwork = networkIDRollup;
        const destinationAddress = deployer.address;
        const metadata = metadataToken;
        let localDepositCount = await polygonZkEVMBridgeContract.depositCount();

        for (let i = 0; i < 10; i++) {
            await expect(tokenContract.approve(polygonZkEVMBridgeContract.address, amount))
                .to.emit(tokenContract, 'Approval')
                .withArgs(deployer.address, polygonZkEVMBridgeContract.address, amount);

            await expect(polygonZkEVMBridgeContract.bridgeAsset(
                destinationNetwork,
                destinationAddress,
                amount,
                tokenAddress,
                true,
                '0x',
            ))
                .to.emit(polygonZkEVMBridgeContract, 'BridgeEvent')
                .withArgs(
                    LEAF_TYPE_ASSET,
                    originNetwork,
                    tokenAddress,
                    destinationNetwork,
                    destinationAddress,
                    amount,
                    metadata,
                    localDepositCount,
                );

            localDepositCount = await polygonZkEVMBridgeContract.depositCount();
        }
    });
});
