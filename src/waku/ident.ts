import EthCrypto, { Encrypted } from "eth-crypto";
import { Address, Hex, PrivateKeyAccount, hashMessage, verifyMessage } from "viem";
import { privateKeyToAccount } from "viem/accounts";

class Ident {
    privateKey: Hex;
    publicKey: Hex;
    account: PrivateKeyAccount;

    constructor(privateKey: Hex) {
        this.privateKey = privateKey;
        this.account = privateKeyToAccount(this.privateKey);
        this.publicKey = this.account.publicKey;
    }

    static createNewIdent(): Ident {
        const privateKey = EthCrypto.createIdentity().privateKey as Hex;
        return new Ident(privateKey);
    }


    async signMessage(message: string) {
        return this.account.signMessage({ message });
    }

    async verifyMessage(message: string, signature: Hex) {
        return await verifyMessage({
            address: this.account.address,
            message,
            signature,
        });
    }

    async encrypt(message: string) {
        return EthCrypto.encryptWithPublicKey(this.publicKey, message);
    }
    
    async decrypt(message: any) {
        return EthCrypto.decryptWithPrivateKey(this.privateKey, message as Encrypted);
    }


}

class Fren {
    nik: string;
    publicKey: Hex;
    address: Address;

    constructor(publicKey: Hex, nik: string = "") {
        this.publicKey = publicKey;
        this.address = EthCrypto.publicKey.toAddress(this.publicKey) as Address;
        this.nik = nik;
    }


    async verifyMessage(message: string, signature: Hex) {
        return await verifyMessage({
            address: this.address,
            message,
            signature,
        });
    }

    async encrypt(message: string) {
        return EthCrypto.encryptWithPublicKey(this.publicKey, message);
    }
    
}

export { Ident, Fren };
export default Ident;