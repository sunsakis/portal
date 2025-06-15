import IdentStore from '../IdentStore';
import { Ident } from '../ident';
import EthCrypto from 'eth-crypto';
import { Hex } from 'viem';

// Mock localStorage
const localStorageMock = (() => {
    let store: { [key: string]: string } = {};
    return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('IdentStore', () => {
    let identStore: IdentStore;
    let testPrivateKey: Hex;
    const portalId: `${string},${string}` = 'test,portal' as `${string},${string}`;


    beforeEach(() => {
        // Clear localStorage before each test
        localStorageMock.clear();
        
        // Create a test private key
        const identity = EthCrypto.createIdentity();
        testPrivateKey = identity.privateKey as Hex;
        
        // Set up localStorage with test data
        localStorageMock.setItem('live.portal.portalKey', testPrivateKey);
        
        identStore = new IdentStore();

    });

    describe('constructor', () => {
        it('should initialize with master identity from localStorage', () => {
            const masterIdent = identStore.getMasterIdent();
            expect(masterIdent).toBeDefined();
            expect(masterIdent.privateKey).toBe(testPrivateKey);
        });

        it('should initialize with empty frens and portalIdents if none exist', () => {
            expect(identStore.getFrens()).toHaveLength(0);
            expect(identStore.getPortalIdents()).toHaveLength(0);
        });
    });

    describe('portal identity management', () => {
        const portalId = 'test,portal' as `${string},${string}`;

        it('should add and get portal identity', () => {
            const portalIdent = identStore.addPortalIdent(portalId);
            expect(portalIdent).toBeDefined();
            expect(portalIdent.privateKey).toBeDefined();

            const retrievedIdent = identStore.getPortalIdent(portalId);
            expect(retrievedIdent).toBe(portalIdent);
        });

        it('should remove portal identity', () => {
            const portalIdent = identStore.addPortalIdent(portalId);
            const removedIdent = identStore.removePortalIdent(portalId);
            expect(removedIdent).toBe(portalIdent);
            expect(identStore.getPortalIdents()).toHaveLength(0);
        });
    });

    describe('fren management', () => {
        const nik = 'testFren';
        let publicKey: Hex;

        beforeEach(() => {
            const identity = EthCrypto.createIdentity();
            publicKey = identity.publicKey as Hex;
        });

        it('should add and get fren', () => {
            identStore.addFren(nik, publicKey);
            const fren = identStore.getFren(nik);
            expect(fren).toBeDefined();
            expect(fren?.publicKey).toBe(publicKey);
            expect(fren?.nik).toBe(nik);
        });

        it('should get all frens', () => {
            identStore.addFren(nik, publicKey);
            const frens = identStore.getFrens();
            expect(frens).toHaveLength(1);
            expect(frens[0].publicKey).toBe(publicKey);
            expect(frens[0].nik).toBe(nik);
        });
    });

    describe('lesBeFrens and hooWanaBeFrens', () => {
        let wannabeFrenIdentStore: IdentStore;
        let wannabeFren: Ident;
        let wannabeFrenPublicKey: Hex;

        beforeEach(() => {
            wannabeFrenIdentStore = new IdentStore();
            wannabeFren = wannabeFrenIdentStore.getMasterIdent();
            wannabeFrenPublicKey = wannabeFren.publicKey;
            identStore.addPortalIdent(portalId);
        });

        it('should complete the friend request flow', async () => {
            const myNik = 'myNik';
            const request = await wannabeFrenIdentStore.lesBeFrens(
                myNik, 
                identStore.getPortalIdent(portalId).publicKey, 
                portalId
            );

            expect(request).toBeDefined();

            const fren = await identStore.hooWanaBeFrens(request as unknown as Hex);

            // const fren = await identStore.hooWanaBeFrens(request as unknown as Hex);

            expect(fren).toBeDefined();
            expect(fren?.nik).toBe(myNik);
        });
    });
}); 