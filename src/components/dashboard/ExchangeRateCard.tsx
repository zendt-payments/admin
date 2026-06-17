import { exchangeCardFlagUrl, exchangeCardTitle } from "../../lib/fxCurrencyDisplay";
import ExchangeRateCornerAccent, { FX_CARD_HEIGHT_PX, FX_CARD_WIDTH_PX } from "./ExchangeRateCornerAccent";

export { FX_CARD_HEIGHT_PX, FX_CARD_WIDTH_PX };

const inrAmountFmt = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type ExchangeRateCardProps = {
  code: string;
  inrPerUnit: number;
  changeVsPriorDaily?: number;
};

export default function ExchangeRateCard({ code, inrPerUnit, changeVsPriorDaily }: ExchangeRateCardProps) {
  const title = exchangeCardTitle(code);
  const amount = inrAmountFmt.format(inrPerUnit);
  const change =
    typeof changeVsPriorDaily === "number" && Number.isFinite(changeVsPriorDaily) ? changeVsPriorDaily : 0;
  const changeText = `${change >= 0 ? "+" : ""}${change.toFixed(4)}`;

  return (
    <article
      className="relative shrink-0 overflow-hidden rounded-[20px] bg-[#161616] text-white"
      style={{ width: FX_CARD_WIDTH_PX, height: FX_CARD_HEIGHT_PX }}
      aria-label={`${title} exchange rate ${amount} Indian rupees`}
    >
      <ExchangeRateCornerAccent flagSrc={exchangeCardFlagUrl(code)} showShadow fullBleed />

      <div className="zendt-dashboard-cairo relative z-[14] flex h-full w-full flex-col justify-between px-5 pb-6 pt-5">
        <p className="zendt-fx-card-currency-label whitespace-nowrap text-caption font-semibold uppercase leading-none text-white">
          {title}
        </p>

        <div className="flex min-h-[52px] w-full flex-col justify-end gap-1">
          <p
            className={
              change >= 0
                ? "whitespace-nowrap text-caption font-semibold leading-none text-[#3DDC84]"
                : "whitespace-nowrap text-caption font-semibold leading-none text-rose-400"
            }
          >
            {changeText}
          </p>
          <p className="whitespace-nowrap text-title font-semibold leading-tight text-white">
            <span className="tabular-nums">{amount}</span>
            <span className="zendt-fx-card-inr-suffix ml-2">INR</span>
          </p>
        </div>
      </div>
    </article>
  );
}
