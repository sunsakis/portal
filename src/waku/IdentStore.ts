import EthCrypto, { Encrypted } from "eth-crypto";
import { Hex, PrivateKeyAccount, hashMessage, verifyMessage } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import Ident, { Fren } from "./ident";

const MASTER_IDENT_KEY = 'live.portal.portalKey';
const FREN_IDENTS_KEY = 'live.portal.frens';
const PORTAL_IDENTS_KEY = 'live.portal.portalIdents';


// TODO: add safePersistence edits, and call them on add 
// TODO: prune portalIdents 
class IdentStore {
    masterIdent: Ident;
    portalIdents: Map<`${string},${string}`, Ident>;
    frens: Map<string, Fren>;
    // HELPERS
    constructor() {
        this.masterIdent = new Ident(this._getKeyFromStorageOrGenerate());
        this._loadFrens();
    }

    getMasterIdent(): Ident {
        return this.masterIdent;
    }

    getPortalIdent(portal: `${string},${string}`): Ident {
        const portalIdent = this.portalIdents.get(portal);

        if (portalIdent) {
            return portalIdent;
        }

        const newIdent = Ident.createNewIdent();
        this.portalIdents.set(portal, newIdent);
        return newIdent;
    }

    getFren(nik: string): Fren | undefined {
        return this.frens.get(nik);
    }
    // IDENT MANAGEMENT

    addPortalIdent(portal: `${string},${string}`): Ident {
        const newIdent = Ident.createNewIdent();
        this.portalIdents.set(portal, newIdent);
        return newIdent;
    }

    removePortalIdent(portal: `${string},${string}`): Ident | undefined {
        const ident = this.portalIdents.get(portal);
        this.portalIdents.delete(portal);
        this._savePortalIdents();
        return ident;
    }

    getPortalIdents(): Ident[] {
        return Array.from(this.portalIdents.values());
    }


    // FREN MANAGEMENT

    addFren(nik: string, publicKey: Hex): void {
        this.frens.set(nik, new Fren(publicKey));
    }

    getFrens(): Fren[] {
        return Array.from(this.frens.values());
    }
    // PERSISTENCE

    private _loadPortalIdents(): void {
        const storedPortalIdents = localStorage.getItem(PORTAL_IDENTS_KEY);
        if (storedPortalIdents) {
            const portalIdentsData = JSON.parse(storedPortalIdents);
            this.portalIdents = new Map(
                Object.entries(portalIdentsData).map(([portal, privateKey]) => [
                    portal as `${string},${string}`,
                    new Ident(privateKey as Hex)
                ])
            );
        } else {
            this.portalIdents = new Map();
        }
    }


    private _savePortalIdents(): void {
        const portalIdentsData = Object.fromEntries(
            Array.from(this.portalIdents.entries()).map(([portal, ident]) => [
                portal,
                ident.privateKey
            ])
        );
        localStorage.setItem(PORTAL_IDENTS_KEY, JSON.stringify(portalIdentsData));
    }

    private _loadFrens(): void {
        const storedFrens = localStorage.getItem(FREN_IDENTS_KEY);
        if (storedFrens) {
            const frensData = JSON.parse(storedFrens);
            this.frens = new Map(
                Object.entries(frensData).map(([nik, publicKey]) => [
                    nik,
                    new Fren(publicKey as Hex)
                ])
            );
        } else {
            this.frens = new Map();
        }
    }

    private _saveFrens(): void {
        const frensData = Object.fromEntries(
            Array.from(this.frens.entries()).map(([nik, fren]) => [
                nik,
                fren.publicKey
            ])
        );
        localStorage.setItem(FREN_IDENTS_KEY, JSON.stringify(frensData));
    }

    // HELPERS    
    private _getKeyFromStorageOrGenerate(): Hex {
        const storedKey = localStorage.getItem(MASTER_IDENT_KEY);
        if (storedKey) {
            return storedKey as Hex;
        }

        // Generate new key pair if none exists
        const privateKey = EthCrypto.createIdentity().privateKey as Hex;
        localStorage.setItem(MASTER_IDENT_KEY, privateKey);
        return privateKey;
    }
}

export default IdentStore;