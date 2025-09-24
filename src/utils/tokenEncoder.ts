/**
 * Utility for encoding and decoding authentication tokens
 * Uses advanced encoding with custom algorithm for better security
 */

export const tokenEncoder = {
	/**
	 * Encode token for storage in cookies
	 * @param token - The token to encode
	 * @returns Encoded token string
	 */
	encode(token: string): string {
		try {
			// Convert to base64 first
			let encoded = btoa(token);

			// Add custom obfuscation
			encoded = this._customEncode(encoded);

			// Add prefix to identify encoded tokens
			return `odys_${encoded}`;
		} catch (error) {
			console.error("Error encoding token:", error);
			return token; // Return original if encoding fails
		}
	},

	/**
	 * Decode token from storage
	 * @param encodedToken - The encoded token to decode
	 * @returns Decoded token string
	 */
	decode(encodedToken: string): string {
		try {
			// Remove prefix and decode
			if (encodedToken.startsWith("odys_")) {
				const tokenWithoutPrefix = encodedToken.substring(5);
				const customDecoded = this._customDecode(tokenWithoutPrefix);
				return atob(customDecoded);
			}
			// If no prefix, assume it's already decoded
			return encodedToken;
		} catch (error) {
			console.error("Error decoding token:", error);
			return encodedToken; // Return original if decoding fails
		}
	},

	/**
	 * Check if a token is encoded
	 * @param token - The token to check
	 * @returns True if token is encoded
	 */
	isEncoded(token: string): boolean {
		return token.startsWith("odys_");
	},

	/**
	 * Custom encoding algorithm for additional obfuscation
	 * @param input - String to encode
	 * @returns Encoded string
	 */
	_customEncode(input: string): string {
		let result = "";
		const key = "odyssea2024"; // Simple key for obfuscation

		for (let i = 0; i < input.length; i++) {
			const charCode = input.charCodeAt(i);
			const keyChar = key.charCodeAt(i % key.length);
			const encodedChar = charCode ^ keyChar; // XOR operation
			result += String.fromCharCode(encodedChar);
		}

		// Convert to base64 for safe storage
		return btoa(result);
	},

	/**
	 * Custom decoding algorithm
	 * @param input - String to decode
	 * @returns Decoded string
	 */
	_customDecode(input: string): string {
		try {
			// First decode from base64
			const base64Decoded = atob(input);
			let result = "";
			const key = "odyssea2024";

			for (let i = 0; i < base64Decoded.length; i++) {
				const charCode = base64Decoded.charCodeAt(i);
				const keyChar = key.charCodeAt(i % key.length);
				const decodedChar = charCode ^ keyChar; // XOR operation (reversible)
				result += String.fromCharCode(decodedChar);
			}

			return result;
		} catch (error) {
			console.error("Error in custom decode:", error);
			return input; // Return original if decoding fails
		}
	},
};
