export type PairedPrinter = { id: string; name: string };
export type PrinterConnectionResult = { connected: boolean; deviceId: string; name: string };
export type PrinterWriteResult = { bytesWritten: number };
export interface SuperQuinaPrinterBridge {
  openBluetoothSettings(): Promise<{ opened: boolean }>;
  listPairedDevices(): Promise<{ devices: PairedPrinter[] }>;
  connect(options: { deviceId: string }): Promise<PrinterConnectionResult>;
  send(options: { dataBase64: string }): Promise<PrinterWriteResult>;
  disconnect(): Promise<{ disconnected: boolean }>;
  getConnectionState(): Promise<{ connected: boolean; deviceId?: string; name?: string }>;
}

declare global {
  interface Window {
    AndroidPrinter?: { imprimir: (text: string) => void; status?: () => string };
  }
}

const unsupported = async (): Promise<never> => {
  throw new Error("A configuração Bluetooth é controlada pelo aplicativo Super Sena. Use o botão Impressora do aplicativo.");
};

/** Compatibility surface for the legacy settings component; Capacitor is no longer used. */
export function getSuperQuinaPrinter(): SuperQuinaPrinterBridge {
  if (typeof window === "undefined" || !window.AndroidPrinter) {
    throw new Error("A impressão Bluetooth está disponível somente no aplicativo Super Sena.");
  }
  return {
    openBluetoothSettings: unsupported,
    listPairedDevices: unsupported,
    connect: unsupported,
    send: unsupported,
    disconnect: unsupported,
    getConnectionState: unsupported,
  };
}
