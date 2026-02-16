declare module '@pdfsmaller/pdf-encrypt-lite/dist/crypto-minimal' {
  export function hexToBytes(hex: string): Uint8Array;
  export function bytesToHex(bytes: Uint8Array): string;
}

declare module '@pdfsmaller/pdf-encrypt-lite/dist/pdf-encrypt' {
  export function computeOwnerKey(ownerPassword: string, userPassword: string): Uint8Array;
  export function computeEncryptionKey(
    userPassword: string,
    ownerKey: Uint8Array,
    permissions: number,
    fileId: Uint8Array,
  ): Uint8Array;
  export function computeUserKey(encryptionKey: Uint8Array, fileId: Uint8Array): Uint8Array;
  export function encryptObject(
    data: Uint8Array,
    objectNum: number,
    generationNum: number,
    encryptionKey: Uint8Array,
  ): Uint8Array;
  export function encryptStringsInObject(
    obj: any,
    objectNum: number,
    generationNum: number,
    encryptionKey: Uint8Array,
  ): void;
}
