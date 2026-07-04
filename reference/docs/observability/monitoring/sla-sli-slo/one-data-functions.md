---
title: One-Data Functions
sidebar_label: One-Data Functions
sidebar_position: 1
---

# SLA · SLI · SLO — One-Data Functions

The **public contracts** consumers integrate against. SLA targets here are
tighter than the underlying APIs because this is the visible surface.

For definitions of SLA / SLI / SLO and how to read each card, see the
[overview page](./).

## Create Payment

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Create Payment</h3>
      <small className="bp-sla__endpoint">One-Data Function · <code>CreatePayment.v3</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.95%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">130<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">270<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">540<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">950<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">1.6<span className="bp-sla__unit">s</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> caller-observed latency at the One-Data edge, including overhead from contract validation. <strong>Error budget:</strong> 0.05% / 30-day window.</p>
</div>

## Update Payment

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Update Payment</h3>
      <small className="bp-sla__endpoint">One-Data Function · <code>UpdatePayment.v1</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.95%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">170<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">340<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">700<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">1.2<span className="bp-sla__unit">s</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">1.9<span className="bp-sla__unit">s</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> end-to-end latency for cancel + recreate semantics handled by <code>#UpdatePaymentWF</code>. <strong>Error budget:</strong> 0.05% / 30-day window.</p>
</div>

## Delete Payment

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Delete Payment</h3>
      <small className="bp-sla__endpoint">One-Data Function · <code>DeletePayment.v1</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.95%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">110<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">220<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">450<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">850<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">1.4<span className="bp-sla__unit">s</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> ack latency for <code>#CancelPaymentWF</code> including eligibility checks. <strong>Error budget:</strong> 0.05% / 30-day window.</p>
</div>

## Read Payments

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Read Payments</h3>
      <small className="bp-sla__endpoint">One-Data Function · <code>ReadPayments.v1</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.99%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">50<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">100<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">210<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">420<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">750<span className="bp-sla__unit">ms</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> account-scoped read latency including pagination. <strong>Error budget:</strong> 0.01% / 30-day window.</p>
</div>

## Read Payment Events By Id

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Read Payment Events By Id</h3>
      <small className="bp-sla__endpoint">One-Data Function · <code>ReadPaymentEventsById.v1</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.99%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">40<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">85<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">180<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">360<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">650<span className="bp-sla__unit">ms</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> latency for fetching a single payment + its lifecycle events. <strong>Error budget:</strong> 0.01% / 30-day window.</p>
</div>

## Create Credit Balance Refund

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Create Credit Balance Refund</h3>
      <small className="bp-sla__endpoint">One-Data Function · <code>CreateCreditBalanceRefund.v1</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.95%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">150<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">300<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">580<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">1<span className="bp-sla__unit">s</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">1.7<span className="bp-sla__unit">s</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> latency through <code>#CreateBalanceRefundWF</code> up to <code>ACCEPTED</code>. <strong>Error budget:</strong> 0.05% / 30-day window.</p>
</div>

## Create Payment Installment

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Create Payment Installment</h3>
      <small className="bp-sla__endpoint">One-Data Function (composite) · <code>CreatePaymentInstallment.v1</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.9%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">240<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">480<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">950<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">1.7<span className="bp-sla__unit">s</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">2.5<span className="bp-sla__unit">s</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> end-to-end latency for the composite — child Create-Immediate + Installments + optional Autopay. <strong>Error budget:</strong> 0.1% / 30-day window.</p>
</div>
