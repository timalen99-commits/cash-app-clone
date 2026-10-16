// Web replacement for @solana-mobile/mobile-wallet-adapter-protocol(-web3js).
// Mobile Wallet Adapter only works on Android, so on web metro resolves both
// packages to this module, which drives an injected browser wallet extension
// (Phantom, Solflare, Backpack) behind the same `transact(wallet => ...)` API.
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { Buffer } from "buffer";

type AnyTransaction = Transaction | VersionedTransaction;

type InjectedProvider = {
  publicKey: { toString(): string } | null;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<unknown>;
  disconnect(): Promise<void>;
  signTransaction<T extends AnyTransaction>(transaction: T): Promise<T>;
  signAllTransactions<T extends AnyTransaction>(transactions: T[]): Promise<T[]>;
  signMessage(
    message: Uint8Array,
    display?: string
  ): Promise<{ signature: Uint8Array } | Uint8Array>;
};

const DEVNET_RPC = "https://api.devnet.solana.com";
const WEB_AUTH_TOKEN = "web-injected-wallet";

export class SolanaMobileWalletAdapterError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SolanaMobileWalletAdapterError";
  }
}

export const SolanaMobileWalletAdapterErrorCode = {
  ERROR_WALLET_NOT_FOUND: "ERROR_WALLET_NOT_FOUND",
} as const;

function getProvider(): InjectedProvider {
  const w = (typeof window !== "undefined" ? window : {}) as any;
  const provider =
    w.phantom?.solana ?? w.solflare ?? w.backpack?.solana ?? w.solana;
  if (!provider) {
    throw new SolanaMobileWalletAdapterError(
      SolanaMobileWalletAdapterErrorCode.ERROR_WALLET_NOT_FOUND,
      "No Solana wallet found. Install the Phantom or Solflare browser extension, then try again."
    );
  }
  return provider;
}

async function connectProvider(provider: InjectedProvider): Promise<PublicKey> {
  if (!provider.publicKey) {
    await provider.connect();
  }
  if (!provider.publicKey) {
    throw new Error("Wallet did not return an account.");
  }
  return new PublicKey(provider.publicKey.toString());
}

function toAuthorizationResult(publicKey: PublicKey) {
  return {
    accounts: [
      {
        address: Buffer.from(publicKey.toBytes()).toString("base64"),
        label: "Browser wallet",
      },
    ],
    auth_token: WEB_AUTH_TOKEN,
    wallet_uri_base: "",
  };
}

function createWebWallet(provider: InjectedProvider) {
  let connection: Connection | null = null;
  const getConnection = () => (connection ??= new Connection(DEVNET_RPC, "confirmed"));

  const authorize = async (_params?: unknown) =>
    toAuthorizationResult(await connectProvider(provider));

  const signTransactions = async <T extends AnyTransaction>({
    transactions,
  }: {
    transactions: T[];
  }): Promise<T[]> => {
    await connectProvider(provider);
    return provider.signAllTransactions(transactions);
  };

  const signAndSendTransactions = async ({
    transactions,
  }: {
    transactions: AnyTransaction[];
  }): Promise<string[]> => {
    const signed = await signTransactions({ transactions });
    return Promise.all(
      signed.map((tx) =>
        getConnection().sendRawTransaction(tx.serialize(), {
          skipPreflight: true,
        })
      )
    );
  };

  return {
    authorize,
    reauthorize: authorize,
    deauthorize: async (_params?: unknown) => {
      await provider.disconnect();
    },
    getCapabilities: async () => ({
      supports_clone_authorization: false,
      supports_sign_and_send_transactions: true,
      max_transactions_per_request: 10,
      max_messages_per_request: 1,
    }),
    signTransactions,
    signAndSendTransactions,
    signMessages: async ({ payloads }: { addresses?: string[]; payloads: Uint8Array[] }) => {
      await connectProvider(provider);
      const results: Uint8Array[] = [];
      for (const payload of payloads) {
        const result = await provider.signMessage(payload, "utf8");
        results.push(result instanceof Uint8Array ? result : result.signature);
      }
      return results;
    },
  };
}

export type Web3MobileWallet = ReturnType<typeof createWebWallet>;

export async function transact<T>(
  callback: (wallet: Web3MobileWallet) => Promise<T> | T,
  _config?: unknown
): Promise<T> {
  return callback(createWebWallet(getProvider()));
}
