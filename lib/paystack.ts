// lib/paystack.ts - UPDATED WITH TRANSACTION INITIALIZATION
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

// Detect if we're in live mode
const IS_LIVE_MODE =
  PAYSTACK_SECRET_KEY?.startsWith("sk_live_") ||
  process.env.NODE_ENV === "production";

export class PaystackService {
  private static baseURL = PAYSTACK_BASE_URL;
  private static secretKey = PAYSTACK_SECRET_KEY;
  private static isLiveMode = IS_LIVE_MODE;

  private static async makeRequest(url: string, options: RequestInit = {}) {
    try {
      console.log(
        `🔍 [PAYSTACK ${this.isLiveMode ? "LIVE" : "TEST"}] Making request to:`,
        url
      );

      if (!this.secretKey) {
        throw new Error("Paystack secret key not configured");
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.status) {
        throw new Error(
          data.message || `HTTP error! status: ${response.status}`
        );
      }

      console.log(
        `✅ [PAYSTACK ${this.isLiveMode ? "LIVE" : "TEST"}] Request successful`
      );
      return data;
    } catch (error: any) {
      console.error(
        `❌ [PAYSTACK ${this.isLiveMode ? "LIVE" : "TEST"}] API error:`,
        error
      );
      throw error;
    }
  }

  // ADD THIS METHOD - Initialize payment transaction
  static async initializeTransaction(
    email: string,
    amount: number, // amount in kobo
    reference: string,
    metadata: any = {},
    callbackUrl?: string
  ): Promise<any> {
    try {
      console.log("🔍 [PAYSTACK] Initializing transaction:", {
        email,
        amount,
        reference,
        metadata,
      });

      if (!this.secretKey) {
        throw new Error("Paystack secret key not configured");
      }

      const payload: any = {
        email,
        amount: Math.round(amount), // Ensure amount is in kobo
        reference,
        metadata,
        currency: "NGN",
      };

      // Add callback URL if provided
      if (callbackUrl) {
        payload.callback_url = callbackUrl;
      }

      const url = `${this.baseURL}/transaction/initialize`;
      const response = await this.makeRequest(url, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      console.log("✅ [PAYSTACK] Transaction initialized successfully");
      return response;
    } catch (error) {
      console.error("❌ [PAYSTACK] Initialize transaction error:", error);
      throw error;
    }
  }

  // Verify transaction (add this too)
  static async verifyTransaction(reference: string): Promise<any> {
    try {
      console.log("🔍 [PAYSTACK] Verifying transaction:", reference);

      const url = `${this.baseURL}/transaction/verify/${reference}`;
      const response = await this.makeRequest(url);

      console.log("✅ [PAYSTACK] Transaction verified successfully");
      return response;
    } catch (error) {
      console.error("❌ [PAYSTACK] Verify transaction error:", error);
      throw error;
    }
  }

  // Get list of supported banks
  static async getBanks(): Promise<any[]> {
    const url = `${this.baseURL}/bank?country=nigeria&currency=NGN`;
    const data = await this.makeRequest(url);
    return data.data;
  }

  // Verify account number
  static async verifyAccountNumber(accountNumber: string, bankCode: string) {
    const url = `${this.baseURL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`;
    return await this.makeRequest(url);
  }

  // Create transfer recipient
  static async createTransferRecipient(
    name: string,
    accountNumber: string,
    bankCode: string,
    type: string = "nuban"
  ) {
    const url = `${this.baseURL}/transferrecipient`;
    return await this.makeRequest(url, {
      method: "POST",
      body: JSON.stringify({
        type,
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      }),
    });
  }

  // Initiate transfer (THIS WILL WORK AFTER UPGRADE)
  static async initiateTransfer(
    amount: number, // in kobo
    recipientCode: string,
    reason: string
  ) {
    const url = `${this.baseURL}/transfer`;
    return await this.makeRequest(url, {
      method: "POST",
      body: JSON.stringify({
        source: "balance",
        amount: Math.round(amount),
        recipient: recipientCode,
        reason,
      }),
    });
  }

  // Complete transfer flow
  static async processPayout(params: {
    amount: number;
    accountNumber: string;
    bankName: string;
    accountName: string;
    reference: string;
    reason?: string;
  }) {
    try {
      // 1. Get banks to find bank code
      const banks = await this.getBanks();
      const bank = banks.find(
        (b) =>
          b.name.toLowerCase().includes(params.bankName.toLowerCase()) ||
          params.bankName.toLowerCase().includes(b.name.toLowerCase())
      );

      if (!bank) {
        throw new Error(`Bank "${params.bankName}" not found`);
      }

      // 2. Verify account number
      const verification = await this.verifyAccountNumber(
        params.accountNumber,
        bank.code
      );

      // 3. Create recipient
      const recipient = await this.createTransferRecipient(
        params.accountName,
        params.accountNumber,
        bank.code
      );

      // 4. Initiate transfer (THIS IS WHAT REQUIRES UPGRADE)
      const transfer = await this.initiateTransfer(
        params.amount,
        recipient.data.recipient_code,
        params.reason || "Publisher payout"
      );

      return {
        success: true,
        transferCode: transfer.data.transfer_code,
        reference: transfer.data.reference,
        recipientCode: recipient.data.recipient_code,
        message: "Payout processed successfully",
      };
    } catch (error: any) {
      console.error("Paystack payout error:", error);
      return {
        success: false,
        error: error.message,
        message: error.message,
      };
    }
  }
}
