# Design decisions

The questions I would expect to be asked about this, and the answers.

## Why so many baselines instead of one good one?

Because the choice of baseline is the answer. There is no observed UK that
stayed in the EU, so any estimate is what happened over what a recipe says
would have happened, and reasonable recipes disagree by more than the effect
being measured. Picking one and reporting it would hide the assumption that
decides the result. Running all of them, and saying which assumption divides
them, shows it.

## Why these three recipes?

They are the three simple ideas most estimates rest on: trade would have kept
its own trend; trade with the EU would have kept pace with trade elsewhere;
or it would have kept pace apart from a drift it was already on. The second
is the one I think most people have in mind when they compare trade with the
EU against trade with everyone else.

More elaborate methods exist: gravity models, or a synthetic UK built from
other countries whose trade tracked the UK's before 2016. They need data on
other countries' trade that this project does not have, and they still rest
on an assumption about what would have happened; they only make it harder to
see.

## Why two cut-offs?

They answer different questions. From 2015, the last full year before the
referendum, the gap includes anything the vote itself did before the rules
changed: uncertainty, stockpiling, firms moving supply chains early. From
2019, the last full year before the new rules and the pandemic, it takes the
years after the vote as given and measures the new rules alone. Neither is
wrong. Using the middle of 2016 instead of 2015 would add half a year of data
and a half-year boundary for no gain in clarity.

## Why every start year from 2001, and at least five years?

Every start year, so that no one can say the window was picked to get an
answer; 2001, so that the test, which moves every year four earlier, still
starts within the data (which begin in 1997); five years for the recipes
with a slope, because a line through fewer years is mostly noise. A
three-year trend was one of the first things I tried, and its test missed by
14.5%.

## Why a four-year test, when the estimate reaches ten years ahead?

Four years is the stretch between the vote and the new rules, 2016 to 2019,
which is the natural test for the 2019 baselines, and I used the same length
for 2015 so that the two are judged alike. A baseline that cannot forecast
four ordinary years has no claim on ten, so the test rules baselines out; it
cannot rule them in. Passing it is necessary, not
sufficient, which is why the result for exports is a split rather than an
answer.

## Is 2016 to 2019 a fair test for the 2019 cut-off? The vote had happened.

It is fair for the question that cut-off asks. The 2019 baselines take
whatever happened after the vote as the normal state of things and measure
the new rules alone, so the years just before the new rules are the right
ones to judge them on. If the vote had already moved trade with the EU by
2019, that is counted in the 2015 baselines and not in these.

## Why 5%?

It is round and it is roughly the size of the smaller effects in question,
so a baseline that misses by more than that could not tell a small effect
from its own error. The README reports the results at 3% as well: imports
stay lower on every baseline that passes, and exports from 2015 stay split.

## Why the latest twelve months?

Twelve months take out what is left of seasonality and one-off shipments,
and the latest twelve are the question people ask: where is trade now? The
README also gives the closest-fitting baselines year by year from 2021, to
show the latest year is not unusual.

## Why chained volumes, not pounds?

A gap in pounds mixes up less trade with different prices. Prices of goods
traded with the EU and with the rest of the world did not move together
after 2021: against 2019, exports to the EU are 5.1% lower in volume but
1.8% higher in current prices. And a trend fitted to pounds before 2016
counts the inflation of 2021 to 2023 as extra trade. Volumes are what
"missing trade" means.

## Why less precious metals?

Non-EU trade in precious metals swings by up to £3.9 billion from one month
to the next, which has nothing to do with Brexit and would swamp every
baseline that uses non-EU trade. The ONS's own trade bulletins quote every
figure without them unless they say otherwise, for the same reason.

## Why is "with non-EU" a geometric mean of the monthly ratios?

So that it is exactly the drift recipe with the slope set to zero: both fit
the logs of the monthly ratio, one with a line and one with a flat level.
Using the ratio of totals instead would make the two recipes differ in a
second way that has nothing to do with drift.

## Why leave the fraud years in?

Because taking them out would be a choice made after seeing the results.
2002 and 2006 are the two biggest years of the ONS's adjustment for
missing-trader VAT fraud, and trade with the EU spikes in both. The README
says which results they drive: the top of the export range, 64.3%, is fitted
from 2006, and the same recipe fitted from 2007 says 45.0%. Anyone who wants
them out can start later in the app.

## Why does the EU's record start in 2021, held to 2016 to 2020?

2016 to 2020 are the last five years before either side changed how it
records this trade: the EU started counting its trade with Great Britain
from customs declarations when the transition period ended in January 2021,
and Great Britain did the same for imports from the EU in January 2022. Over those five years the UK recorded
94p arriving for every £1 the EU recorded sending. From 2021, each month's UK
figure is scaled by 94p over that month's ratio, which moves UK imports from
the EU in line with the EU's record while keeping the UK's prices. It assumes
the difference between the two records is in what was counted, not in its
price.

## Why not use the EU's record of what it buys from the UK?

Since 2021 the EU records imports from outside the EU by country of origin,
where before it used the country the goods were sent from. Goods sent from
the UK but made elsewhere stopped counting as coming from the UK, so the
series breaks at exactly the moment that matters.

## Why not Eurostat's volume index?

It deflates by unit values, the value of each flow over its quantity, which
move with the mix of goods as well as their prices. Against the ONS's volumes
it drifted 70.3% from 2002 to 2019, before anything changed, so a trend in it
measures the two methods as much as trade.

## Why no single central estimate?

An average of baselines is only as meaningful as the list it averages, and
the list is mine. The README gives the range, the baselines that pass, the
closest-fitting one for each cut-off and my own reading of the evidence,
labelled as a reading.

## Why the OBR's number is not on the chart

It is the number most people have heard, so the README quotes it. But it is
an assumption about all UK trade, goods and services, relative to the size
of the economy, in the long run. Putting it on the same axis as the gap in
goods trade with the EU would invite a comparison the two cannot support.
