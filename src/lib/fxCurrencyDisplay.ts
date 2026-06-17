import { flagImageUrlForCurrency } from "../constants/currencyFlagAlpha2";

/** 3-letter ISO label — spacing comes from CSS `letter-spacing` on the card, not manual spaces. */
export function exchangeCardTitle(code: string): string {
  return code.trim().toUpperCase();
}

export function exchangeCardFlagUrl(code: string): string {
  return flagImageUrlForCurrency(code);
}
