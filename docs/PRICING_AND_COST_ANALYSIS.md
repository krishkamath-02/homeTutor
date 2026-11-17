# HomeTutor – Cost Analysis, Unit Economics & Monetization Strategy

This document provides a comprehensive market breakdown, unit economics, infrastructure costs, and subscription models for HomeTutor across both the **Global (US/International)** and **Indian** markets.

---

## 1. Underlying AI & Compute Infrastructure Costs

HomeTutor uses Google Gemini Multimodal Flash (`gemini-flash-latest` / `gemini-1.5-flash` / `gemini-2.0-flash`) for:
* **Stage 1 (Homework Analysis):** Scans homework images, extracts topics, concepts, difficulty, and learning objectives.
* **Stage 2 (Question Generation):** Synthesizes pedagogical questions, 4 distinct options, correct answers, and step-by-step reasoning.

### Token Consumption per Generated Test:
* **Input Tokens:** ~2,000 tokens (1–2 homework images + educator analysis prompt).
* **Output Tokens:** ~1,100 tokens (JSON concept analysis + 5 questions with options and explanations).

### Official Google Gemini Pricing:
* **Input:** $0.075 per 1,000,000 tokens ($0.00015 per test)
* **Output:** $0.30 per 1,000,000 tokens ($0.00033 per test)
* **Total Cost per Single Test:** **~$0.00048** (approximately **$0.0005**, or **1/20th of a cent** / **~₹0.04** in INR).

---

## 2. Usage & Cost Scenarios per User

| Activity Level | Tests / Day | Tests / Month | Monthly Cost (USD) | Monthly Cost (INR) |
|---|:---:|:---:|:---:|:---:|
| **Casual Free User** | 1 test | 30 tests | **$0.015** | **₹1.25** |
| **Active Daily User** | 3 tests | 90 tests | **$0.043** | **₹3.60** |
| **Heavy Family User (3 Kids)**| 10 tests | 300 tests | **$0.145** | **₹12.00** |

### Infrastructure Cost at Scale:
* **100 Active Daily Users** (9,000 tests/month): **~$4.30 / month** (~₹360/mo)
* **1,000 Active Daily Users** (90,000 tests/month): **~$43.00 / month** (~₹3,600/mo)
* **10,000 Active Daily Users** (900,000 tests/month): **~$430.00 / month** (~₹36,000/mo)

---

## 3. The 3 Subscription Tiers (Option A Architecture)

```
                 ┌────────────────────────────────────────────────────────┐
                 │                   HOMETUTOR TIERS                      │
                 └────────────────────────────────────────────────────────┘
                                      │
         ┌────────────────────────────┼───────────────────────────┐
         ▼                            ▼                           ▼
   🥉 FREE PLAN                 🥈 PRO PLAN                 🥇 PREMIUM PLAN
   • $0 / ₹0                    • $9.99 / ₹299 mo           • $19.99 / ₹599 mo
   • 2 Children max             • 3 Children max            • Unlimited Children
   • 3 Tests / day              • Unlimited Tests           • Priority AI Processing
   • Basic scores & review      • Full Topic Mastery        • Teacher-ready PDF reports
                                • Weak Spot Alerts          • Dual Parent Login
```

### Feature Comparison Matrix:

| Feature | 🥉 Free Plan | 🥈 Pro Plan | 🥇 Premium (Family) Plan |
|---|:---:|:---:|:---:|
| **Child Profiles** | **Up to 2 children** | **Up to 3 children** | **Unlimited children** |
| **Daily Test Generations** | **3 tests / day** | **Unlimited** | **Unlimited (Priority AI)** |
| **Questions per Test** | Standard 5 questions | 5, 10, or 15 questions | Up to 20 questions + Custom Prompts |
| **Question Types** | Multiple Choice (MCQ) | MCQ + Short Answer + Fill-in | All types + Step-by-step reasoning drills |
| **Basic Scores & Review** | Included | Included | Included |
| **Topic Mastery Analytics** | Recent 3 only | **Full Mastery Breakdown** | **Full Mastery + 90-day Trends** |
| **Weak Spot Diagnostics** | Locked | **Concept Alerts** | **Auto-Generated Remediation Quizzes** |
| **Parent Accounts** | 1 parent | 1 parent | **Dual Parent Sync (Mom & Dad)** |
| **Printable Worksheets** | Basic web view | **Clean PDF Worksheets + Answers** | **Custom Branded PDFs** |
| **Teacher Reports** | None | Screen summary | **Exportable Monthly Report Cards** |

---

## 4. Market Pricing Strategy: US vs. Indian Market

### A. Global / US Market:

| Plan | Monthly Billing | Annual Billing | Psychological Anchor |
|---|:---:|:---:|---|
| **Free** | $0 | $0 | Try with your family risk-free |
| **Pro** | **$9.99 / mo** | **$79 / yr** *(~$6.58/mo — 34% off)* | Less than 15 minutes with a human tutor ($40/hr) |
| **Premium** | **$19.99 / mo** | **$149 / yr** *(~$12.42/mo — 38% off)* | Complete all-in-one family learning platform |

* **Pro Gross Profit Margin:** **~93%** (Revenue: $9.99, Costs: ~$0.69 incl. Stripe fee & AI).
* **Premium Gross Profit Margin:** **~94%** (Revenue: $19.99, Costs: ~$1.13 incl. Stripe fee & AI).

---

### B. Indian Market:

| Plan | Monthly Billing | Annual Billing *(Recommended for India)* | Psychological Anchor |
|---|:---:|:---:|---|
| **Free** | ₹0 | ₹0 | 2 kids, 3 tests daily free |
| **Pro** | **₹299 / mo** | **₹1,999 / yr** *(~₹166/mo — 44% off)* | Less than half the cost of one single tuition class |
| **Premium** | **₹599 / mo** | **₹3,999 / yr** *(~₹333/mo — 44% off)* | Complete tutoring & exam prep for all kids |

* **Pro Gross Profit Margin (INR):** **~95%** (Revenue: ₹299, Costs: ~₹13.60 incl. Razorpay 2% & AI).
* **Payment Method Recommendation for India:**
  * **Razorpay / Cashfree UPI One-Time Annual Checkout:** Indian parents overwhelmingly prefer UPI (Google Pay, PhonePe, Paytm). Annual plans avoid RBI recurring card e-mandate friction and provide upfront annual cash flow.

---

## 5. Strategic Monetization Roadmap

1. **Launch Phase (Free + Pro):**
   * Keep the free tier generous (2 kids, 3 tests/day) to build trust and word-of-mouth adoption.
   * Offer Pro at introductory pricing to convert initial power users.
2. **Growth Phase (Introduce Premium / Family):**
   * Activate the Premium plan as families with 3+ children request additional profiles and multi-parent sync.
3. **Institutional / School Phase (Future):**
   * Teacher license where a tutor/teacher can manage a class of 20–30 students.
