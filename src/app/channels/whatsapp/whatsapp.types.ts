export interface WhatsAppPhoneInfoResponse {
	phoneNumberId: string;
	displayPhoneNumber: string;
	verifiedName: string;
	wabaId: string;
	phoneNumberStatus: string;
}

export interface WhatsAppCallbackResponse {
	accountId: string;
	phoneNumbers: WhatsAppPhoneInfoResponse[];
}
