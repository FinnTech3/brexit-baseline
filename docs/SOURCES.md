# Sources

All four files were downloaded on 25 September 2026 and are committed as
downloaded, except that the ONS file is compressed with xz; it decompresses
to the original byte for byte.

| File | Publisher and title | SHA-256 |
|---|---|---|
| `ons_mret.csv.xz` | ONS, *Trade in goods: all countries, seasonally adjusted* (MRETS), released 11 September 2026: every monthly, quarterly and annual trade in goods series on the balance of payments basis, by partner and commodity section. The original `mret.csv` is 8,714,883 bytes. | original `709396edc5ff8d3111550dc1f55555b15da84535d78b2677e4232b2852167785`; compressed `7d5dcd0243c7cefb0e40e8ec0bb6c8fabb3b66fff3d290239b1751ef4fa50f00` |
| `eurostat_eu_exports_to_uk.json` | Eurostat, `ext_st_eu27_2020sitc`: EU27 (from 2020) exports to the United Kingdom, all products, seasonally and calendar adjusted, million euro, monthly, January 2002 to July 2026, updated 15 September 2026 | `d7ed80d3601eb749f8bc44c4e966fe032b4ec8898b4de7213a0795f0c7d8edf6` |
| `eurostat_eur_gbp.json` | Eurostat, `ert_bil_eur_m`: pound sterling per euro, monthly average, updated 5 September 2026 (before 1999 the rate is for the ECU; only 2002 on is used) | `727d971e59479a01374d5917db405fc8aa7c01b2dcb12329189896600a9fa583` |
| `eurostat_eu_exports_to_uk_volume.json` | Eurostat, `ext_st_eu27_2020sitc`: the same exports as a seasonally and calendar adjusted volume index, 2021 = 100. Kept only to show why it is not used. | `3a5b23593e6122e06e287cbe2cc599050a73d8d1da473bad38941c02c9e2ea8d` |

Addresses:

- MRETS: https://www.ons.gov.uk/economy/nationalaccounts/balanceofpayments/datasets/tradeingoodsmretsallbopeu2013timeseriesspreadsheet
  (file: `/file?uri=/economy/nationalaccounts/balanceofpayments/datasets/tradeingoodsmretsallbopeu2013timeseriesspreadsheet/current/mret.csv`)
- Eurostat exports, values: https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/ext_st_eu27_2020sitc?format=JSON&lang=EN&freq=M&partner=UK&sitc06=TOTAL&stk_flow=EXP&indic_et=TRD_VAL_SCA&geo=EU27_2020
- Eurostat exports, volume index: the same address with `indic_et=IVOL_SCA`
- Eurostat exchange rates: https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/ert_bil_eur_m?format=JSON&lang=EN&currency=GBP&statinfo=AVG&unit=NAC

## The series used

All seasonally adjusted, £ million, balance of payments basis. CP is current
prices; CVM is chained volume measures, with 2023 as the reference year (in
2023 each volume equals its current-price value, which a test checks).

| | EU | Non-EU |
|---|---|---|
| Exports, less precious metals, CVM | JIM8 | JIN3 |
| Imports, less precious metals, CVM | JIM7 | JIN2 |
| Exports, less precious metals, CP | FSL4 | FSL7 |
| Imports, less precious metals, CP | FSL5 | FSL8 |

For the checks: all goods by partner (L87S, L87U, L87M, L87O in CP; LGCN,
LGDF, LGEB, LGEU in CVM), the world (BOKG, BOKH; BQKQ, BQKO), precious metals
(FSJ6, FSJ4, FSJ9, FSJ8) and the ten SITC sections for each partner, flow
and measure, found by their titles. For the records comparison, all goods
imports from the EU, L87U. For the note on fraud, OFNN, the ONS's adjustment
to imports for missing trader intra-community fraud, in CVM.

## Quoted, not downloaded as data

Read on 25 September 2026.

- ONS, *UK trade: January 2022*, released 11 March 2022, section 2, "Changes
  affecting UK trade statistics":
  https://www.ons.gov.uk/economy/nationalaccounts/balanceofpayments/bulletins/uktrade/january2022.
  Quoted: EU imports to Great Britain "are now being collected using custom
  declarations ... rather than captured by the Intrastat survey"; the
  statistics from January 2022 "are not directly comparable with previous
  months"; HMRC "are confident that the strong rise in imports from the EU
  this month is predominantly the result of genuine increases in trade". The
  same bulletin is the source of the quote on non-monetary gold. The page as
  read had SHA-256 `70d5da76388b105d950fd6f2e478fcf0f4586a4eff9b71e6c9a5728808af70c9`.
- Eurostat, *International trade in goods, aggregated data*, reference
  metadata: https://ec.europa.eu/eurostat/cache/metadata/en/ext_go_agg_esms.htm.
  The partner country "is the last known country of destination for intra-
  and extra-EU exports, the country of origin for extra-EU imports and the
  country of consignment for intra-EU imports". It also says trade with the
  UK adds up trade with Northern Ireland, still collected through the EU's
  Intrastat survey, and trade with the rest of the UK, from customs
  declarations. Page SHA-256 as read:
  `9a31a1768f290e9329e7a34cef7179b70dbbc93b7e79d0a5083113fb977ac4fa`.
- Office for Budget Responsibility, *Brexit analysis*, last updated 20 July
  2026, setting out the assumptions behind the March 2026 forecast:
  https://obr.uk/forecasts-in-depth/the-economy-forecast/brexit-analysis/.
  Quoted: "Both exports and imports will be around 15 per cent lower in the
  long run than if the UK had remained in the EU." The page calls this a
  reduction in trade intensity. Page SHA-256 as read:
  `b170792e90d3772f4952132dd4655676c1fc9a9dfc133678f0b4f5f0898f6ebd`.

## Traps, and what was done about them

- **Chained volumes do not add up.** Only current prices can be checked by
  summing parts, so the checks run on current prices and the twin shows what
  happens on volumes.
- **Precious metals.** Since 2016 non-EU trade in precious metals has swung by
  £1 billion or more from one month to the next in 21 of 127 months for
  exports and 30 for imports, by up to £3.9 billion. Every series in the
  study leaves precious metals out.
- **The EU import break in 2022.** See the README. The UK's own record is the
  default; the EU's is offered beside it, not instead.
- **Mirror data that switched basis.** The EU's imports from the UK moved from
  country of consignment to country of origin in 2021, so they are not used.
  Its exports to the UK are recorded by destination throughout.
- **A volume index that is not a volume.** Eurostat's index deflates by unit
  values, the value of each flow over its quantity, which moves with the mix
  of goods as well as with prices. Against the ONS's volumes it drifted 70.3%
  from 2002 to 2019.
- **Fraud years.** 2002 and 2006, the two biggest years of the ONS's
  missing-trader fraud adjustment, show as spikes in trade with the EU. They
  are left in, and the README says which results they drive.
- **Euro before 1999.** The exchange-rate series starts in 1971 with the ECU.
  Nothing before 2002 is used.

## Licences

ONS data: Open Government Licence v3.0. Eurostat data: reused under
Eurostat's copyright notice, with acknowledgement of the source.
