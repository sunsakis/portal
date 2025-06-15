import EthCrypto, { Encrypted, hash } from 'eth-crypto';
const { keccak256 } = hash;
import { hashMessage, Hex, PrivateKeyAccount, verifyMessage } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import Ident, { Fren } from './ident';

const MASTER_IDENT_KEY = 'live.portal.portalKey';
const FREN_IDENTS_KEY = 'live.portal.frens';
const PORTAL_IDENTS_KEY = 'live.portal.portalIdents';

const LES_BE_FREN_MESSAGE = "Lesbe Frens! I'm ";
const LES_BE_FREN_SIG_PREFIX = 'SSS';
const LES_BE_FREN_PORTAL_ID_PREFIX = 'PPP';

export const MASTER_PORTAL_ID = "master,key" as `${string},${string}`;
// TODO: add safePersistence edits, and call them on add
// TODO: prune portalIdents
class IdentStore {
  masterIdent: Ident;
  portalIdents: Map<`${string},${string}`, Ident>;
  frens: Map<string, Fren>;

  constructor() {
    this.masterIdent = new Ident(this._getKeyFromStorageOrGenerate());
    this._loadFrens();
    this._loadPortalIdents();
  }

  async lesBeFrens(
    myNik: string,
    wannabeFrenPortalKey: Hex,
    portalId: `${string},${string}` = MASTER_PORTAL_ID as `${string},${string}`,
  ): Promise<string> {
    const masterIdent = this.getMasterIdent();
    const message = LES_BE_FREN_MESSAGE + myNik;
    const messageSig = await masterIdent.signMessage(message);

    const payload = message + LES_BE_FREN_SIG_PREFIX + messageSig;
    const encryptedIdent = await EthCrypto.encryptWithPublicKey(wannabeFrenPortalKey.replace(/^0x/, ""), payload);
    return portalId + LES_BE_FREN_PORTAL_ID_PREFIX + JSON.stringify(encryptedIdent);
  }

  async hooWanaBeFrens(lesBeFrensRequest: Hex): Promise<Fren | undefined> {
    const [portalId, encryptedRequest] = lesBeFrensRequest.split(
      LES_BE_FREN_PORTAL_ID_PREFIX,
    );
    let portalIdent: Ident;
    if (portalId === MASTER_PORTAL_ID) {
        portalIdent = this.masterIdent;
    } else {
     portalIdent = this.getPortalIdent(portalId as `${string},${string}`);
    }
    if (!portalIdent) {
      return undefined;
    }

    const decryptedRequest = await portalIdent.decrypt(JSON.parse(encryptedRequest));
    const [message, messageSig] = decryptedRequest.split(LES_BE_FREN_SIG_PREFIX);

    const frenNik = message.split(LES_BE_FREN_MESSAGE)[1];

    const frenPublicKey = EthCrypto.recoverPublicKey(
        messageSig,
        EthCrypto.hash.keccak256(message)
    );

    const fren = new Fren(frenPublicKey as Hex, frenNik);

    return fren;
  }

  async showYouReAFrenToAll(portalPubKey: Hex, frenPubKey: Hex): Promise<string[]> {
    const frenSignals = await Promise.all(Array.from(this.frens.values()).map(
        fren => this._prepareShowYouReAFren(portalPubKey, fren.publicKey)
    ));
    return frenSignals;
  };

  async recoverSenderIfFren(secretIds: string[]): Promise<Fren | undefined> {
    const anyFren = await Promise.all(secretIds.map(this._recoverFrenFromSecretId));
    return anyFren.find((fren) => fren !== undefined);
  }

  private async _prepareShowYouReAFren(portalPubKey: Hex, frenPubKey: Hex): Promise<string> {
    const messageSig = await this.masterIdent.signMessage(keccak256(portalPubKey));
    const payload = portalPubKey + LES_BE_FREN_SIG_PREFIX + messageSig;
    const encryptedPayload = await EthCrypto.encryptWithPublicKey(frenPubKey.replace(/^0x/, ""), payload);
    return JSON.stringify(encryptedPayload);
  }

  private async _recoverFrenFromSecretId(secretId: string): Promise<Fren | undefined> {

    const decryptedRequest = await this.masterIdent.decrypt(JSON.parse(secretId));
    const [message, messageSig] = decryptedRequest.split(LES_BE_FREN_SIG_PREFIX);
    
    const recoveredPublicKey = EthCrypto.recoverPublicKey(
        messageSig,
        EthCrypto.hash.keccak256(message)
    );

    return this.getFrenByPublicKey(recoveredPublicKey as Hex);
  }

  // GETTERS
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

  getFrenByPublicKey(publicKey: Hex): Fren | undefined {
    return Array.from(this.frens.values()).find((fren) => fren.publicKey === publicKey);
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
    this.frens.set(nik, new Fren(publicKey, nik));
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
          new Ident(privateKey as Hex),
        ]),
      );
    } else {
      this.portalIdents = new Map();
    }
  }

  private _savePortalIdents(): void {
    const portalIdentsData = Object.fromEntries(
      Array.from(this.portalIdents.entries()).map(([portal, ident]) => [
        portal,
        ident.privateKey,
      ]),
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
          new Fren(publicKey as Hex),
        ]),
      );
    } else {
      this.frens = new Map();
    }
  }

  private _saveFrens(): void {
    const frensData = Object.fromEntries(
      Array.from(this.frens.entries()).map(([nik, fren]) => [
        nik,
        fren.publicKey,
      ]),
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
