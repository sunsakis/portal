import { Fren } from '../ident';
import EthCrypto from 'eth-crypto';
import { Hex } from 'viem';

describe('Fren', () => {
    let fren: Fren;
    let publicKey: Hex;
    let privateKey: Hex;
    const nik = 'testFren';

    beforeEach(() => {
        // Create a new identity to get a public key
        const identity = EthCrypto.createIdentity();
        publicKey = identity.publicKey as Hex;
        privateKey = identity.privateKey as Hex;
        fren = new Fren(publicKey, nik);
    });

    describe('constructor', () => {
        it('should create a Fren instance with valid public key and nickname', () => {
            expect(fren).toBeDefined();
            expect(fren.publicKey).toBe(publicKey);
            expect(fren.nik).toBe(nik);
            expect(fren.address).toBeDefined();
        });

        it('should create a Fren instance with empty nickname', () => {
            const frenWithoutNik = new Fren(publicKey);
            expect(frenWithoutNik).toBeDefined();
            expect(frenWithoutNik.publicKey).toBe(publicKey);
            expect(frenWithoutNik.nik).toBe('');
            expect(frenWithoutNik.address).toBeDefined();
        });
    });

    describe('verifyMessage', () => {
        it('should verify a message signed by the corresponding private key', async () => {
            const message = 'Hello, World!';
            const signature = await EthCrypto.sign(privateKey, EthCrypto.hash.keccak256(message));
            
            const isValid = await fren.verifyMessage(message, signature as Hex);
            expect(isValid).toBe(true);
        });

        it('should fail to verify with wrong message', async () => {
            const message = 'Hello, World!';
            const wrongMessage = 'Hello, Wrong World!';
            const signature = await EthCrypto.sign(privateKey, EthCrypto.hash.keccak256(message));
            
            const isValid = await fren.verifyMessage(wrongMessage, signature as Hex);
            expect(isValid).toBe(false);
        });
    });

    describe('encrypt', () => {
        it('should encrypt a message with the public key', async () => {
            const message = 'Secret message';
            const encrypted = await fren.encrypt(message);
            expect(encrypted).toBeDefined();
            expect(typeof encrypted).toBe('object');
        });
    });
}); 