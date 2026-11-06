/**
 * Demo company: Brewline Coffee Co. ALL DATA IS FICTIONAL. Any resemblance
 * to real businesses or people is coincidental.
 */
export const DEMO_COMPANY_NAME = "Brewline Coffee Co.";

const customers = `customer,city,segment,monthly_kg,annual_revenue_inr,plan,contract_end,account_manager,notes
Chai & Chapter Cafe,Mumbai,Cafe,180,1944000,Roaster Pro,2027-03-31,Aditi,Asked for oat-milk friendly blend
Bandra Bakehouse,Mumbai,Bakery,95,1026000,Standard,2026-12-31,Aditi,Pays late (avg 18 days)
Koramangala Co-Work,Bengaluru,Office,240,2304000,Office Bulk,2027-06-30,Rohan,Wants a second machine on floor 4
Pune Pedal Cyclery,Pune,Retail,40,456000,Standard,2026-11-30,Rohan,Renewal call pending
Hotel Saffron Bay,Goa,Hospitality,320,3456000,Roaster Pro,2027-09-30,Meera,Largest single-site account
Lotus Tech Park Canteen,Hyderabad,Office,410,3936000,Office Bulk,2027-01-31,Meera,Discount 8% agreed until Jan 2027
Little Leaf Kindergarten (staff room),Mumbai,Office,12,158400,Starter,2026-12-15,Aditi,Small but loyal
Monsoon Records Studio,Mumbai,Office,30,342000,Standard,2027-02-28,Aditi,
The Filter House,Chennai,Cafe,150,1620000,Roaster Pro,2027-04-30,Kiran,Competitor BeanWorks pitched them in Oct
Ghats Trek Hostel,Lonavala,Hospitality,60,684000,Standard,2027-05-31,Rohan,Seasonal: drops 40% in monsoon
Spice Route Restaurant,Kochi,Restaurant,85,969000,Standard,2027-03-15,Kiran,
Northstar Fintech,Bengaluru,Office,275,2640000,Office Bulk,2027-08-31,Rohan,Security review required before renewal
Cubbon Book Cafe,Bengaluru,Cafe,110,1188000,Roaster Pro,2026-12-31,Rohan,At risk: complained about delivery delays twice
Marine Drive Juice Bar,Mumbai,Retail,25,285000,Starter,2027-01-31,Aditi,
Himalaya Health Clinic,Delhi,Office,45,513000,Standard,2027-07-31,Meera,
Connaught Coffee Collective,Delhi,Cafe,200,2160000,Roaster Pro,2027-10-31,Meera,Wants exclusive single-origin lot
Riverside Hospital Cafeteria,Ahmedabad,Hospitality,380,3648000,Office Bulk,2027-12-31,Kiran,Net-45 payment terms
Startup Garage Coworking,Pune,Office,130,1248000,Office Bulk,2027-02-28,Rohan,
Udaipur Lake Palace Lounge,Udaipur,Hospitality,140,1680000,Roaster Pro,2027-06-30,Meera,Premium blend only
Jaipur Jewel Bakers,Jaipur,Bakery,70,756000,Standard,2026-11-30,Kiran,Renewal call pending`;

const priceSheet = `# Brewline Coffee Co. Wholesale Price Sheet (CONFIDENTIAL)
Effective: 1 October 2026 · Prices in INR, excluding 5% GST · FICTIONAL DEMO DATA

## Coffee (per kg, roasted)
| Blend | List price | Floor price (do not go below) | Our cost |
|---|---|---|---|
| House Espresso (Chikmagalur arabica/robusta 70/30) | ₹1,150 | ₹980 | ₹640 |
| Monsoon Malabar Single Origin | ₹1,450 | ₹1,250 | ₹820 |
| Coorg Estate Filter Blend | ₹950 | ₹820 | ₹520 |
| Decaf Swiss Water | ₹1,600 | ₹1,400 | ₹1,010 |

## Plans
- **Starter**: up to 25 kg/month, list price, delivery every 2 weeks.
- **Standard**: 26–100 kg/month, 5% off list, weekly delivery.
- **Roaster Pro**: 101–250 kg/month, 10% off list, free barista training (2 sessions/yr).
- **Office Bulk**: 250+ kg/month, 12% off list, machine lease included (₹4,500/month value).

## Discount rules
- Sales can approve up to 5% extra discount. Above that needs a founder (Ananya or Vikram).
- Never quote below the floor price. Current gross margin target: 38%.
- Multi-year (24 months) prepay: extra 3%.

## Internal notes
- BeanWorks (competitor) is undercutting us by ~7% on House Espresso in Chennai and Bengaluru.
- Planned price increase of 6% on 1 April 2027 due to arabica futures; do not share with customers yet.
`;

const supplierContract = `SUPPLY AGREEMENT (FICTIONAL DEMO DOCUMENT)

Between: Highland Bean Growers Cooperative, Chikmagalur, Karnataka ("Supplier")
And: Brewline Coffee Co. Pvt. Ltd., Mumbai ("Buyer")
Agreement No. HBG-BRW-2026-07 · Effective date: 1 July 2026 · Term: 24 months (ends 30 June 2028)

1. PRODUCTS AND PRICE
1.1 Green arabica (Grade AA, washed): ₹410 per kg.
1.2 Green robusta (Kaapi Royale): ₹265 per kg.
1.3 Prices are fixed for the first 12 months. From 1 July 2027 prices may be revised by at most 8% with 60 days' written notice.

2. VOLUME COMMITMENT
2.1 Buyer commits to a minimum of 2,400 kg per quarter (combined arabica and robusta).
2.2 Shortfall penalty: if Buyer orders less than 85% of the quarterly minimum, Buyer pays 15% of the price of the shortfall quantity.

3. EXCLUSIVITY
3.1 Supplier will not sell its "Baba Budan Reserve" micro-lot to any other buyer in Maharashtra during the Term.
3.2 Buyer has no exclusivity obligation.

4. DELIVERY AND QUALITY
4.1 Delivery to Buyer's Bhiwandi warehouse within 10 business days of a purchase order.
4.2 Lots scoring below 80 points (SCA cupping) may be rejected within 7 days of delivery at Supplier's cost.

5. PAYMENT
5.1 Net 30 days from invoice. Late payment interest: 1.5% per month.

6. TERMINATION
6.1 Either party may terminate for convenience with 90 days' written notice after the first 12 months.
6.2 Either party may terminate immediately for material breach not cured within 30 days of notice.
6.3 On termination by Buyer for convenience in months 13–24, Buyer pays a one-time fee of ₹3,00,000.

7. CONFIDENTIALITY
7.1 Pricing in this Agreement is confidential for 3 years after termination.

8. GOVERNING LAW
8.1 Laws of India; courts of Mumbai have exclusive jurisdiction.

Signed: R. Gowda (Supplier) · Ananya Rao, Co-founder & CEO (Buyer) · 28 June 2026
`;

export const DEMO_DOCS = [
  { name: "customers.csv", mime: "text/csv", text: customers },
  { name: "price-sheet-oct-2026.md", mime: "text/markdown", text: priceSheet },
  { name: "supplier-contract-highland.txt", mime: "text/plain", text: supplierContract },
];

export const DEMO_QUESTIONS = [
  "Which customers are up for renewal before the end of 2026, and who manages them?",
  "What is our cheapest price we can quote for House Espresso, and what margin is that?",
  "What happens if we order too little from Highland Bean Growers in a quarter?",
  "Who are our top 3 customers by annual revenue?",
];

export const DEMO_COFOUNDERS = ["Ananya Rao (CEO)", "Vikram Shah (CTO)", "Zoya Iqbal (COO)"];
