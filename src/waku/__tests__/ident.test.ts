import { Ident } from '../ident';
import EthCrypto from 'eth-crypto';
import { Hex } from 'viem';

describe('Ident', () => {
    let ident: Ident;
    let privateKey: Hex;

    beforeEach(() => {
        // Create a new identity for each test
        const identity = EthCrypto.createIdentity();
        privateKey = identity.privateKey as Hex;
        ident = new Ident(privateKey);
    });

    describe('constructor', () => {
        it('should create an Ident instance with valid private key', () => {
            expect(ident).toBeDefined();
            expect(ident.privateKey).toBe(privateKey);
            expect(ident.publicKey).toBeDefined();
            expect(ident.account).toBeDefined();
        });
    });

    describe('createNewIdent', () => {
        it('should create a new Ident instance with generated private key', () => {
            const newIdent = Ident.createNewIdent();
            expect(newIdent).toBeDefined();
            expect(newIdent.privateKey).toBeDefined();
            expect(newIdent.publicKey).toBeDefined();
            expect(newIdent.account).toBeDefined();
        });
    });

    describe('signMessage and verifyMessage', () => {
        it('should sign and verify a message', async () => {
            const message = 'Hello, World!';
            const signature = await ident.signMessage(message);
            const isValid = await ident.verifyMessage(message, signature);
            expect(isValid).toBe(true);
        });

        it('should fail to verify with wrong message', async () => {
            const message = 'Hello, World!';
            const wrongMessage = 'Hello, Wrong World!';
            const signature = await ident.signMessage(message);
            const isValid = await ident.verifyMessage(wrongMessage, signature);
            expect(isValid).toBe(false);
        });
    });

    describe('encrypt and decrypt', () => {
        it('should encrypt and decrypt a message', async () => {
            const message = 'Secret message';
            // Create a new identity for encryption
            const otherIdent = Ident.createNewIdent();
            const encrypted = await otherIdent.encrypt(message);
            const decrypted = await otherIdent.decrypt(encrypted);
            expect(decrypted).toBe(message);
        });
    });
}); 